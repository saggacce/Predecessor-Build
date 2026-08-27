import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { AppError } from '../middleware/error-handler.js';

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
    }).parse(req.body);
    const playerId = await ownPlayer(req.user!.userId);
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
      },
    });
    res.status(201).json({ cycle: { ...cycle, matchesPlayed: 0, progress: 0 } });
  } catch (error) {
    next(error);
  }
});

playerLearningRouter.patch('/cycles/:id', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['COMPLETED', 'ARCHIVED']) }).parse(req.body);
    const existing = await db.playerTrainingCycle.findFirst({ where: { id: String(req.params.id), userId: req.user!.userId } });
    if (!existing) throw new AppError(404, 'Training cycle not found', 'TRAINING_CYCLE_NOT_FOUND');
    const cycle = await db.playerTrainingCycle.update({
      where: { id: existing.id },
      data: { status: body.status, completedAt: body.status === 'COMPLETED' ? new Date() : existing.completedAt },
    });
    res.json({ cycle });
  } catch (error) {
    next(error);
  }
});
