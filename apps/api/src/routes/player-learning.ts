import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { AppError } from '../middleware/error-handler.js';
import { getCoachKnowledgeCoverage, searchCoachEncyclopedia } from '../services/coach-encyclopedia-service.js';
import { LEARNING_QUESTIONS, MISSION_TEMPLATES, competencyLabel } from '../services/player-learning-catalog.js';
import {
  ensureLearningProfile,
  presentLearningProfile,
  recommendMission,
  recordQuestionAnswer,
  selectPlacementQuestions,
  summarizePlacement,
} from '../services/player-learning-service.js';
import { evaluateLiveMode, evaluateLiveModeSignals, type LiveModeSignal } from '../services/live-training-policy.js';
import { buildLearningProgress } from '../services/player-learning-progress-service.js';
import { decideLiveCoachDelivery, LIVE_COACH_EVENT_TYPES } from '../services/live-coach-delivery-policy.js';
import { buildLiveTrainingReview } from '../services/live-training-report-service.js';

export const playerLearningRouter = Router();

const reviewStatus = z.enum(['PENDING', 'CONFIRMED_MISTAKE', 'GOOD_DECISION', 'INCONCLUSIVE']);

async function ownPlayer(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { linkedPlayerId: true } });
  if (!user?.linkedPlayerId) throw new AppError(400, 'No player linked to this account', 'NO_PLAYER_LINKED');
  return user.linkedPlayerId;
}

async function assertOwnMatchPlayer(userId: string, matchId: string, matchPlayerId: string) {
  const playerId = await ownPlayer(userId);
  const matchPlayer = await db.matchPlayer.findFirst({
    where: { id: matchPlayerId, matchId, playerId },
    select: { id: true },
  });
  if (!matchPlayer) throw new AppError(403, 'This replay review does not belong to your linked player', 'FORBIDDEN');
  return playerId;
}

async function ownProfile(userId: string) {
  const playerId = await ownPlayer(userId);
  return ensureLearningProfile(userId, playerId);
}

playerLearningRouter.get('/knowledge/coverage', requireAuth, async (_req, res, next) => {
  try {
    res.json(await getCoachKnowledgeCoverage());
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/knowledge', requireAuth, async (req, res, next) => {
  try {
    const query = z.object({
      q: z.string().trim().max(100).optional(),
      kind: z.enum(['concept', 'hero', 'item', 'loadout', 'eternal_category']).optional(),
      role: z.enum(['CARRY', 'SUPPORT', 'MIDLANE', 'JUNGLE', 'OFFLANE']).optional(),
      limit: z.coerce.number().int().min(1).max(60).optional(),
    }).parse(req.query);
    res.json(await searchCoachEncyclopedia({ query: query.q, kind: query.kind, role: query.role, limit: query.limit }));
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/profile/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    res.json({ profile: presentLearningProfile(profile), recommendation: recommendMission(profile.competencies) });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/progress/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    const [attempts, cycles, replayMarkers, liveEvents] = await Promise.all([
      db.coachQuestionAttempt.findMany({
        where: { profileId: profile.id },
        select: { id: true, competencyKey: true, sourceType: true, evaluation: true, score: true, answeredAt: true },
        orderBy: { answeredAt: 'asc' },
        take: 240,
      }),
      db.playerTrainingCycle.findMany({
        where: { profileId: profile.id, status: 'COMPLETED' },
        select: { id: true, competencyKey: true, title: true, evaluation: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
        take: 80,
      }),
      db.playerReplayMarker.findMany({
        where: { session: { profileId: profile.id }, status: { not: 'PENDING' } },
        select: { id: true, status: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
        take: 160,
      }),
      db.liveTrainingEvent.findMany({
        where: { session: { profileId: profile.id } },
        select: { id: true, eventType: true, confidence: true, evidence: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 240,
      }),
    ]);
    res.json({ profile: presentLearningProfile(profile), ...buildLearningProgress({ attempts, cycles, replayMarkers, liveEvents }) });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.patch('/profile/me', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ activeRole: z.enum(['CARRY', 'SUPPORT', 'MIDLANE', 'JUNGLE', 'OFFLANE']).nullable() }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const updated = await db.playerLearningProfile.update({ where: { id: profile.id }, data: { activeRole: body.activeRole }, include: { competencies: true } });
    res.json({ profile: presentLearningProfile(updated) });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/placement', requireAuth, async (req, res, next) => {
  try {
    let profile = await ownProfile(req.user!.userId);
    const currentQuestions = selectPlacementQuestions(profile.activeRole);
    const currentKeys = currentQuestions.map((question) => question.key);
    const answered = await db.coachQuestionAttempt.findMany({ where: { profileId: profile.id, sourceType: 'PLACEMENT', questionKey: { in: currentKeys } }, select: { questionKey: true, competencyKey: true, score: true } });
    const answeredKeys = new Set(answered.map((attempt) => attempt.questionKey));
    const questions = currentQuestions.filter((question) => !answeredKeys.has(question.key));
    if (questions.length > 0 && profile.placementStatus !== 'IN_PROGRESS') {
      profile = await db.playerLearningProfile.update({ where: { id: profile.id }, data: { placementStatus: 'IN_PROGRESS' }, include: { competencies: true } });
    }
    res.json({
      status: profile.placementStatus,
      questions,
      answered: answeredKeys.size,
      total: currentQuestions.length,
      summary: summarizePlacement(answered, profile.activeRole),
      note: 'El diagnóstico mide conocimiento y criterio. El rango práctico se confirma con partidas, misiones y revisiones.',
    });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/questions/:questionKey/answer', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      selectedOptionId: z.string().min(1),
      sourceType: z.enum(['PLACEMENT', 'MATCH', 'REPLAY', 'REVIEW', 'PROMOTION']).default('PLACEMENT'),
      sourceMatchId: z.string().nullable().optional(),
      evidence: z.record(z.string(), z.unknown()).optional(),
    }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    if (body.sourceType === 'PLACEMENT') {
      const existing = await db.coachQuestionAttempt.findFirst({ where: { profileId: profile.id, sourceType: 'PLACEMENT', questionKey: String(req.params.questionKey) }, select: { id: true } });
      if (existing) throw new AppError(409, 'This placement situation was already answered', 'QUESTION_ALREADY_ANSWERED');
    }
    const result = await recordQuestionAnswer({ profileId: profile.id, questionKey: String(req.params.questionKey), placementRole: profile.activeRole, ...body });
    res.status(201).json({ result });
  } catch (error) {
    if (error instanceof Error && error.message === 'QUESTION_NOT_FOUND') return next(new AppError(404, 'Learning question not found', 'QUESTION_NOT_FOUND'));
    if (error instanceof Error && error.message === 'OPTION_NOT_FOUND') return next(new AppError(400, 'Question option not found', 'OPTION_NOT_FOUND'));
    next(error);
  }
});

playerLearningRouter.get('/missions/recommended', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    res.json({ mission: recommendMission(profile.competencies), templates: MISSION_TEMPLATES });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/promotion', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    const [completedCycles, promotionAttempts] = await Promise.all([
      db.playerTrainingCycle.findMany({
        where: { profileId: profile.id, status: 'COMPLETED', competencyKey: { not: null } },
        select: { competencyKey: true, completedAt: true },
      }),
      db.coachQuestionAttempt.findMany({
        where: { profileId: profile.id, sourceType: 'PROMOTION' },
        select: { competencyKey: true, answeredAt: true },
        orderBy: { answeredAt: 'desc' },
      }),
    ]);
    const latestPromotion = new Map<string, Date>();
    for (const attempt of promotionAttempts) {
      if (!latestPromotion.has(attempt.competencyKey)) latestPromotion.set(attempt.competencyKey, attempt.answeredAt);
    }
    const completedAfterLatestTest = new Set(completedCycles.filter((cycle) => {
      if (!cycle.competencyKey || !cycle.completedAt) return false;
      const lastTest = latestPromotion.get(cycle.competencyKey);
      return !lastTest || cycle.completedAt > lastTest;
    }).map((cycle) => cycle.competencyKey).filter(Boolean));
    const competency = [...profile.competencies]
      .filter((item) => item.level < 5 && item.evidenceCount >= 4 && item.mastery >= 0.65 && completedAfterLatestTest.has(item.competencyKey))
      .sort((a, b) => b.mastery - a.mastery)[0];
    if (!competency) {
      res.json({ eligible: false, reason: 'Completa una misión y reúne al menos cuatro evidencias consistentes en esa competencia.' });
      return;
    }
    const role = profile.activeRole?.toUpperCase();
    const candidates = LEARNING_QUESTIONS.filter((item) => item.competencyKey === competency.competencyKey
      && (!item.roles?.length || item.roles.includes(role ?? '')));
    const question = candidates.find((item) => item.level > competency.level)
      ?? candidates.find((item) => item.level >= competency.level)
      ?? candidates[0];
    if (!question) {
      res.json({ eligible: false, reason: 'Aún no hay una prueba de ascenso revisada para esta competencia.' });
      return;
    }
    res.json({
      eligible: true,
      competency: { key: competency.competencyKey, label: competencyLabel(competency.competencyKey), currentLevel: competency.level },
      question: { ...question, options: question.options.map(({ id, text }) => ({ id, text })) },
    });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/matches/:matchId/reviews', requireAuth, async (req, res, next) => {
  try {
    const matchPlayerId = z.string().min(1).parse(req.query.matchPlayerId);
    await assertOwnMatchPlayer(req.user!.userId, String(req.params.matchId), matchPlayerId);
    const reviews = await db.playerLearningMomentReview.findMany({
      where: { userId: req.user!.userId, matchId: String(req.params.matchId), matchPlayerId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.put('/matches/:matchId/reviews/:momentId', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      matchPlayerId: z.string().min(1),
      status: reviewStatus,
      note: z.string().trim().max(1200).nullable().optional(),
    }).parse(req.body);
    await assertOwnMatchPlayer(req.user!.userId, String(req.params.matchId), body.matchPlayerId);
    const reviewedAt = body.status === 'PENDING' ? null : new Date();
    const review = await db.playerLearningMomentReview.upsert({
      where: {
        userId_matchId_momentId: {
          userId: req.user!.userId,
          matchId: String(req.params.matchId),
          momentId: String(req.params.momentId),
        },
      },
      create: {
        userId: req.user!.userId,
        matchId: String(req.params.matchId),
        matchPlayerId: body.matchPlayerId,
        momentId: String(req.params.momentId),
        status: body.status,
        note: body.note ?? null,
        reviewedAt,
      },
      update: { status: body.status, note: body.note ?? null, reviewedAt },
    });
    res.json({ review });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/cycles/me', requireAuth, async (req, res, next) => {
  try {
    const playerId = await ownPlayer(req.user!.userId);
    const cycles = await db.playerTrainingCycle.findMany({
      where: { userId: req.user!.userId, playerId },
      orderBy: { startedAt: 'desc' },
      take: 12,
    });
    const enriched = await Promise.all(cycles.map(async (cycle) => {
      const matchesPlayed = await db.matchPlayer.count({
        where: { playerId, match: { startTime: { gte: cycle.startedAt } } },
      });
      return { ...cycle, matchesPlayed: Math.min(matchesPlayed, cycle.targetMatches), progress: Math.min(1, matchesPlayed / cycle.targetMatches) };
    }));
    res.json({ cycles: enriched });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/cycles', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      focusKey: z.string().trim().min(1).max(120),
      title: z.string().trim().min(1).max(180),
      cue: z.string().trim().min(1).max(1200),
      targetMatches: z.number().int().min(3).max(10).default(5),
      sourceMatchId: z.string().min(1).nullable().optional(),
      sourceMomentId: z.string().min(1).nullable().optional(),
      competencyKey: z.string().trim().min(1).max(80).nullable().optional(),
      learningLevel: z.number().int().min(1).max(5).nullable().optional(),
      successCriteria: z.record(z.string(), z.unknown()).nullable().optional(),
    }).parse(req.body);
    const playerId = await ownPlayer(req.user!.userId);
    const profile = body.competencyKey ? await ensureLearningProfile(req.user!.userId, playerId) : null;
    const active = await db.playerTrainingCycle.findFirst({ where: { userId: req.user!.userId, playerId, status: 'ACTIVE' } });
    if (active) throw new AppError(409, 'Finish or archive the active training cycle before starting another', 'ACTIVE_CYCLE_EXISTS');
    if (body.sourceMatchId) {
      const ownsSource = await db.matchPlayer.findFirst({ where: { playerId, matchId: body.sourceMatchId }, select: { id: true } });
      if (!ownsSource) throw new AppError(403, 'The source match does not belong to your linked player', 'FORBIDDEN');
    }
    const cycle = await db.playerTrainingCycle.create({
      data: {
        userId: req.user!.userId,
        playerId,
        focusKey: body.focusKey,
        title: body.title,
        cue: body.cue,
        targetMatches: body.targetMatches,
        sourceMatchId: body.sourceMatchId ?? null,
        sourceMomentId: body.sourceMomentId ?? null,
        profileId: profile?.id ?? null,
        competencyKey: body.competencyKey ?? null,
        learningLevel: body.learningLevel ?? profile?.overallLevel ?? null,
        successCriteria: body.successCriteria ?? undefined,
      },
    });
    res.status(201).json({ cycle: { ...cycle, matchesPlayed: 0, progress: 0 } });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/replays', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    const sessions = await db.playerReplaySession.findMany({
      where: { profileId: profile.id }, include: { markers: { orderBy: { gameTime: 'asc' } } }, orderBy: { updatedAt: 'desc' }, take: 30,
    });
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/replays', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      matchId: z.string().nullable().optional(), matchPlayerId: z.string().nullable().optional(),
      title: z.string().trim().min(1).max(180), recordingUrl: z.string().url().max(2000).nullable().optional(),
      durationSeconds: z.number().int().positive().nullable().optional(), offsetSeconds: z.number().int().min(-7200).max(7200).default(0),
      markers: z.array(z.object({
        gameTime: z.number().int().min(0), sourceEventId: z.string().nullable().optional(), category: z.string().max(80),
        title: z.string().max(180), question: z.string().max(1200),
      })).max(80).default([]),
    }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    if (body.matchId && body.matchPlayerId) await assertOwnMatchPlayer(req.user!.userId, body.matchId, body.matchPlayerId);
    const session = await db.playerReplaySession.create({
      data: {
        profileId: profile.id, matchId: body.matchId ?? null, matchPlayerId: body.matchPlayerId ?? null,
        title: body.title, recordingUrl: body.recordingUrl ?? null, durationSeconds: body.durationSeconds ?? null,
        offsetSeconds: body.offsetSeconds, status: body.recordingUrl ? 'READY' : 'DRAFT',
        markers: { create: body.markers.map((marker) => ({ ...marker, videoTime: Math.max(0, marker.gameTime + body.offsetSeconds) })) },
      }, include: { markers: true },
    });
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.patch('/replays/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      title: z.string().trim().min(1).max(180).optional(),
      recordingUrl: z.string().url().max(2000).nullable().optional(),
      offsetSeconds: z.number().int().min(-7200).max(7200).optional(),
    }).refine((value) => Object.keys(value).length > 0, { message: 'At least one replay field is required' }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const existing = await db.playerReplaySession.findFirst({ where: { id: String(req.params.sessionId), profileId: profile.id } });
    if (!existing) throw new AppError(404, 'Replay review not found', 'REPLAY_NOT_FOUND');
    const session = await db.$transaction(async (tx) => {
      const offsetSeconds = body.offsetSeconds ?? existing.offsetSeconds;
      if (body.offsetSeconds !== undefined) {
        const markers = await tx.playerReplayMarker.findMany({ where: { sessionId: existing.id }, select: { id: true, gameTime: true } });
        for (const marker of markers) {
          await tx.playerReplayMarker.update({ where: { id: marker.id }, data: { videoTime: Math.max(0, marker.gameTime + offsetSeconds) } });
        }
      }
      return tx.playerReplaySession.update({
        where: { id: existing.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.recordingUrl !== undefined ? { recordingUrl: body.recordingUrl, status: body.recordingUrl ? 'READY' : 'DRAFT' } : {}),
          ...(body.offsetSeconds !== undefined ? { offsetSeconds } : {}),
        },
        include: { markers: { orderBy: { gameTime: 'asc' } } },
      });
    });
    res.json({ session });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.patch('/replays/:sessionId/markers/:markerId', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ status: reviewStatus, conclusion: z.string().trim().max(1600).nullable().optional() }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const marker = await db.playerReplayMarker.findFirst({
      where: { id: String(req.params.markerId), sessionId: String(req.params.sessionId), session: { profileId: profile.id } },
    });
    if (!marker) throw new AppError(404, 'Replay marker not found', 'REPLAY_MARKER_NOT_FOUND');
    if (marker.status !== 'PENDING' && body.status === 'PENDING') {
      throw new AppError(409, 'A reviewed replay moment cannot be reset to pending', 'REPLAY_REVIEW_ALREADY_CREDITED');
    }
    const updated = await db.playerReplayMarker.update({ where: { id: marker.id }, data: body });
    if (marker.status === 'PENDING' && body.status !== 'PENDING') {
      await db.playerCompetency.updateMany({
        where: { profileId: profile.id, competencyKey: 'review_autonomy' },
        data: { appliedCount: { increment: 1 }, evidenceCount: { increment: 1 }, lastEvidenceAt: new Date() },
      });
    }
    res.json({ marker: updated });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/live/sessions', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ requestedGameMode: z.string().trim().min(1).max(40), captureConsent: z.literal(true) }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const policy = evaluateLiveMode(body.requestedGameMode);
    const session = await db.liveTrainingSession.create({
      data: {
        profileId: profile.id, requestedGameMode: policy.normalized, captureConsent: true,
        modeVerification: policy.verification, status: policy.status,
        rankedBlockedAt: policy.verification === 'BLOCKED_RANKED' ? new Date() : null,
      },
    });
    res.status(201).json({
      session,
      canAdvise: policy.canAdvise,
      reason: policy.verification === 'BLOCKED_RANKED' ? 'Ranked está bloqueado de forma permanente.' : 'La captura puede iniciarse, pero el coach permanece desactivado hasta verificar el modo automáticamente.',
    });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/live/sessions/:id/verify-mode', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      detectedGameMode: z.string().trim().min(1).max(40),
      signal: z.object({ source: z.enum(['screen_ocr', 'screen_template', 'match_api']), confidence: z.number().min(0).max(1), capturedAt: z.string().datetime() }),
    }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const existing = await db.liveTrainingSession.findFirst({ where: { id: String(req.params.id), profileId: profile.id } });
    if (!existing) throw new AppError(404, 'Live training session not found', 'LIVE_SESSION_NOT_FOUND');
    if (existing.modeVerification === 'BLOCKED_RANKED') throw new AppError(403, 'Ranked blocking is permanent for this session', 'LIVE_RANKED_BLOCK_PERMANENT');
    const previousSignals = Array.isArray(existing.verificationSignals)
      ? existing.verificationSignals.filter((signal): signal is LiveModeSignal => !!signal && typeof signal === 'object')
      : [];
    const signals: LiveModeSignal[] = [...previousSignals, { ...body.signal, detectedGameMode: body.detectedGameMode }].slice(-6);
    const policy = evaluateLiveModeSignals(signals);
    const session = await db.liveTrainingSession.update({
      where: { id: existing.id },
      data: {
        detectedGameMode: policy.normalized === 'UNKNOWN' ? null : policy.normalized, verificationSignals: signals,
        modeVerification: policy.verification, status: policy.status,
        rankedBlockedAt: policy.verification === 'BLOCKED_RANKED' ? new Date() : existing.rankedBlockedAt,
      },
    });
    res.json({ session, canAdvise: policy.canAdvise, reason: policy.canAdvise ? null : policy.verification === 'BLOCKED_RANKED' ? 'Ranked está bloqueado.' : policy.verification === 'UNVERIFIED' ? 'Esperando una segunda señal automática independiente.' : 'Las señales no permiten verificar un modo autorizado.' });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/live/sessions/:id/end', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    const existing = await db.liveTrainingSession.findFirst({ where: { id: String(req.params.id), profileId: profile.id } });
    if (!existing) throw new AppError(404, 'Live training session not found', 'LIVE_SESSION_NOT_FOUND');
    if (existing.endedAt) {
      res.json({ session: existing });
      return;
    }
    const status = existing.status === 'BLOCKED'
      ? 'BLOCKED'
      : existing.modeVerification === 'VERIFIED_ALLOWED' ? 'COMPLETED' : 'ABORTED';
    const session = await db.liveTrainingSession.update({
      where: { id: existing.id },
      data: { status, endedAt: new Date() },
    });
    res.json({ session });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.get('/live/sessions/:id/report', requireAuth, async (req, res, next) => {
  try {
    const profile = await ownProfile(req.user!.userId);
    const session = await db.liveTrainingSession.findFirst({
      where: { id: String(req.params.id), profileId: profile.id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new AppError(404, 'Live training session not found', 'LIVE_SESSION_NOT_FOUND');
    const byType = session.events.reduce<Record<string, number>>((counts, event) => {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
      return counts;
    }, {});
    const spoken = session.events.filter((event) => !!event.advice).length;
    const review = buildLiveTrainingReview(session.startedAt, session.events);
    res.json({
      report: {
        id: session.id,
        requestedGameMode: session.requestedGameMode,
        detectedGameMode: session.detectedGameMode,
        modeVerification: session.modeVerification,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        summary: { observations: session.events.length, spoken, silent: session.events.length - spoken, byType },
        review,
        events: session.events.map((event) => ({
          id: event.id,
          gameTime: event.gameTime,
          eventType: event.eventType,
          confidence: event.confidence,
          advice: event.advice,
          evidence: event.evidence,
          createdAt: event.createdAt,
        })),
        limitation: session.modeVerification === 'VERIFIED_ALLOWED'
          ? 'Las observaciones proceden de señales visibles y no sustituyen la revisión del replay.'
          : 'La sesión no reunió dos fuentes independientes; no se emitieron consejos ni se usa como evidencia observada.',
      },
    });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/live/sessions/:id/events', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ gameTime: z.number().int().min(0).nullable().optional(), eventType: z.string().max(80), evidence: z.record(z.string(), z.unknown()), advice: z.string().max(500).nullable().optional(), confidence: z.enum(['low', 'medium', 'high']) }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const session = await db.liveTrainingSession.findFirst({ where: { id: String(req.params.id), profileId: profile.id } });
    if (!session) throw new AppError(404, 'Live training session not found', 'LIVE_SESSION_NOT_FOUND');
    if (session.modeVerification !== 'VERIFIED_ALLOWED' || session.status !== 'ACTIVE') throw new AppError(403, 'Live advice is disabled until an allowed mode is verified', 'LIVE_MODE_NOT_ALLOWED');
    const event = await db.liveTrainingEvent.create({ data: { sessionId: session.id, ...body } });
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.post('/live/sessions/:id/observations', requireAuth, async (req, res, next) => {
  try {
    const observationSchema = z.object({
      competencyKey: z.enum(['moba_fundamentals', 'role_knowledge', 'macro', 'micro_concepts', 'builds', 'champion_pool', 'review_autonomy']),
      learningScore: z.number().min(0).max(1).optional(),
      explanation: z.string().trim().min(10).max(1200),
      detector: z.string().trim().min(1).max(100),
      rubricId: z.string().trim().min(1).max(100).optional(),
      inputs: z.array(z.string().trim().min(1).max(80)).max(20),
      missingInputs: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
      capturedAt: z.string().datetime(),
      inCombat: z.boolean(),
      state: z.record(z.string(), z.unknown()).optional(),
    }).superRefine((value, context) => {
      if (value.learningScore !== undefined && !value.rubricId) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['rubricId'], message: 'A scored observation requires a reviewed rubric' });
      }
    });
    const body = z.object({
      gameTime: z.number().int().min(0).nullable().optional(),
      eventType: z.enum(LIVE_COACH_EVENT_TYPES),
      confidence: z.number().min(0).max(1),
      observation: observationSchema,
      candidateAdvice: z.object({
        priority: z.enum(['NORMAL', 'HIGH']),
        title: z.string().trim().min(1).max(120),
        cue: z.string().trim().min(1).max(280),
        reason: z.string().trim().min(10).max(600),
        principle: z.string().trim().min(10).max(600),
      }).nullable().optional(),
    }).parse(req.body);
    const profile = await ownProfile(req.user!.userId);
    const session = await db.liveTrainingSession.findFirst({ where: { id: String(req.params.id), profileId: profile.id } });
    if (!session) throw new AppError(404, 'Live training session not found', 'LIVE_SESSION_NOT_FOUND');
    if (session.modeVerification !== 'VERIFIED_ALLOWED' || session.status !== 'ACTIVE') {
      throw new AppError(403, 'Live coaching is disabled until an allowed mode is verified', 'LIVE_MODE_NOT_ALLOWED');
    }
    const recentAdvice = await db.liveTrainingEvent.findMany({
      where: { sessionId: session.id, advice: { not: null } },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const decision = decideLiveCoachDelivery({
      eventType: body.eventType,
      confidence: body.confidence,
      inCombat: body.observation.inCombat,
      candidateAdvice: body.candidateAdvice,
      recentAdvice,
    });
    const event = await db.liveTrainingEvent.create({
      data: {
        sessionId: session.id,
        gameTime: body.gameTime ?? null,
        eventType: body.eventType,
        confidence: body.confidence >= 0.93 ? 'high' : body.confidence >= 0.85 ? 'medium' : 'low',
        evidence: { ...body.observation, confidence: body.confidence, candidateAdvice: body.candidateAdvice ?? null, delivery: decision.delivery, suppressionReason: decision.reason },
        advice: decision.delivery === 'SPEAK' ? decision.advice.cue : null,
      },
    });
    res.status(201).json({ event, delivery: decision.delivery, advice: decision.advice, reason: decision.reason });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.patch('/cycles/:id', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(['COMPLETED', 'ARCHIVED']),
      evaluation: z.object({
        outcome: z.enum(['ACHIEVED', 'PARTIAL', 'NOT_YET']),
        reflection: z.string().trim().min(20).max(1600),
      }).optional(),
    }).parse(req.body);
    const existing = await db.playerTrainingCycle.findFirst({ where: { id: String(req.params.id), userId: req.user!.userId } });
    if (!existing) throw new AppError(404, 'Training cycle not found', 'TRAINING_CYCLE_NOT_FOUND');
    if (existing.status !== 'ACTIVE') throw new AppError(409, 'This training cycle is already closed', 'TRAINING_CYCLE_ALREADY_CLOSED');
    if (body.status === 'COMPLETED' && existing.competencyKey && !body.evaluation) {
      throw new AppError(400, 'Review the mission result before completing it', 'MISSION_REVIEW_REQUIRED');
    }
    if (body.status === 'COMPLETED') {
      const matchesPlayed = await db.matchPlayer.count({
        where: { playerId: existing.playerId, match: { startTime: { gte: existing.startedAt } } },
      });
      if (matchesPlayed < existing.targetMatches) {
        throw new AppError(409, `Complete ${existing.targetMatches} practice matches before reviewing this mission`, 'MISSION_PRACTICE_INCOMPLETE');
      }
    }
    const now = new Date();
    const cycle = await db.$transaction(async (tx) => {
      const updated = await tx.playerTrainingCycle.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          completedAt: body.status === 'COMPLETED' ? now : existing.completedAt,
          evaluation: body.evaluation ? { ...body.evaluation, reviewedAt: now.toISOString(), evidenceType: 'PLAYER_REFLECTION' } : undefined,
        },
      });
      if (body.status === 'COMPLETED' && body.evaluation && existing.profileId && existing.competencyKey) {
        const competency = await tx.playerCompetency.findUnique({
          where: { profileId_competencyKey: { profileId: existing.profileId, competencyKey: existing.competencyKey } },
        });
        if (competency) {
          const outcomeScore = body.evaluation.outcome === 'ACHIEVED' ? 1 : body.evaluation.outcome === 'PARTIAL' ? 0.6 : 0.25;
          const previousWeight = Math.min(competency.evidenceCount, 4);
          const evidenceWeight = 0.6;
          const mastery = ((competency.mastery * previousWeight) + (outcomeScore * evidenceWeight)) / (previousWeight + evidenceWeight);
          await tx.playerCompetency.update({
            where: { id: competency.id },
            data: {
              mastery: Math.max(0, Math.min(1, mastery)),
              confidence: Math.min(1, (competency.evidenceCount + 1) / 5),
              evidenceCount: { increment: 1 },
              appliedCount: { increment: 1 },
              lastEvidenceAt: now,
              nextReviewAt: new Date(now.getTime() + (body.evaluation.outcome === 'ACHIEVED' ? 7 : 2) * 86_400_000),
            },
          });
        }
      }
      return updated;
    });
    res.json({ cycle });
  } catch (error) {
    next(error);
  }
});
