import { db } from '../db.js';
import {
  COMPETENCIES,
  LEARNING_LEVELS,
  LEARNING_QUESTIONS,
  MISSION_TEMPLATES,
  competencyLabel,
  levelLabel,
} from './player-learning-catalog.js';

const DEFAULT_MASTERY = 0.25;

export async function ensureLearningProfile(userId: string, playerId: string) {
  const profile = await db.playerLearningProfile.upsert({
    where: { userId },
    create: {
      userId,
      playerId,
      competencies: {
        create: COMPETENCIES.map(({ key }) => ({ competencyKey: key, mastery: DEFAULT_MASTERY })),
      },
    },
    update: { playerId },
    include: { competencies: true },
  });

  const missing = COMPETENCIES.filter(({ key }) => !profile.competencies.some((item) => item.competencyKey === key));
  if (missing.length > 0) {
    await db.playerCompetency.createMany({
      data: missing.map(({ key }) => ({ profileId: profile.id, competencyKey: key, mastery: DEFAULT_MASTERY })),
      skipDuplicates: true,
    });
    return db.playerLearningProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { competencies: true } });
  }
  return profile;
}

export function presentLearningProfile(profile: Awaited<ReturnType<typeof ensureLearningProfile>>) {
  const ordered = COMPETENCIES.map((definition) => {
    const state = profile.competencies.find((item) => item.competencyKey === definition.key);
    return {
      ...definition,
      level: state?.level ?? 1,
      levelLabel: levelLabel(state?.level ?? 1),
      mastery: state?.mastery ?? DEFAULT_MASTERY,
      confidence: state?.confidence ?? 0,
      evidenceCount: state?.evidenceCount ?? 0,
      nextReviewAt: state?.nextReviewAt ?? null,
    };
  });
  return {
    id: profile.id,
    playerId: profile.playerId,
    overallLevel: profile.overallLevel,
    overallLevelLabel: levelLabel(profile.overallLevel),
    placementStatus: profile.placementStatus,
    activeRole: profile.activeRole,
    explanationDepth: profile.explanationDepth,
    confidence: profile.confidence,
    competencies: ordered,
    levels: LEARNING_LEVELS,
  };
}

export function selectPlacementQuestions(role?: string | null, count = 10) {
  const normalizedRole = role?.toUpperCase() ?? null;
  const general = LEARNING_QUESTIONS.filter((question) => !question.roles?.length);
  const roleQuestions = normalizedRole
    ? LEARNING_QUESTIONS.filter((question) => question.roles?.includes(normalizedRole))
    : [];
  const generalTarget = Math.max(0, count - roleQuestions.length);
  const buckets = new Map(COMPETENCIES.map(({ key }) => [
    key,
    general.filter((question) => question.competencyKey === key),
  ]));
  const balanced: typeof general = [];
  while (balanced.length < generalTarget) {
    let added = false;
    for (const { key } of COMPETENCIES) {
      const next = buckets.get(key)?.shift();
      if (!next) continue;
      balanced.push(next);
      added = true;
      if (balanced.length >= generalTarget) break;
    }
    if (!added) break;
  }
  const selected = [...balanced, ...roleQuestions].slice(0, count);
  const stableHash = (value: string) => [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
  return selected.map(({ options, ...question }) => {
    const answerOptions = options.filter((option) => option.id !== 'not_sure')
      .sort((a, b) => stableHash(`${question.key}:${a.id}`) - stableHash(`${question.key}:${b.id}`));
    const unsure = options.filter((option) => option.id === 'not_sure');
    return {
      ...question,
      options: [...answerOptions, ...unsure].map(({ score: _score, evaluation: _evaluation, feedback: _feedback, ...option }) => option),
    };
  });
}

export async function recordQuestionAnswer(input: {
  profileId: string;
  questionKey: string;
  selectedOptionId: string;
  sourceType: 'PLACEMENT' | 'MATCH' | 'REPLAY' | 'REVIEW' | 'PROMOTION';
  sourceMatchId?: string | null;
  evidence?: unknown;
  placementRole?: string | null;
}) {
  const question = LEARNING_QUESTIONS.find((item) => item.key === input.questionKey);
  if (!question) throw new Error('QUESTION_NOT_FOUND');
  const option = question.options.find((item) => item.id === input.selectedOptionId);
  if (!option) throw new Error('OPTION_NOT_FOUND');

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.playerCompetency.findUniqueOrThrow({
      where: { profileId_competencyKey: { profileId: input.profileId, competencyKey: question.competencyKey } },
    });
    const evidenceCount = existing.evidenceCount + 1;
    // Prior evidence decays gradually; one answer can inform but never prove mastery.
    const mastery = Math.max(0, Math.min(1, ((existing.mastery * Math.min(existing.evidenceCount, 4)) + option.score) / (Math.min(existing.evidenceCount, 4) + 1)));
    const confidence = Math.min(1, evidenceCount / 5);
    const level = input.sourceType === 'PROMOTION' && option.score >= 0.8 && mastery >= 0.75 && evidenceCount >= 5
      ? Math.min(5, existing.level + 1)
      : existing.level;
    const now = new Date();
    const nextReviewAt = new Date(now.getTime() + (option.score >= 0.8 ? 7 : 2) * 86_400_000);
    const attempt = await tx.coachQuestionAttempt.create({
      data: {
        profileId: input.profileId,
        questionKey: question.key,
        competencyKey: question.competencyKey,
        learningLevel: question.level,
        sourceType: input.sourceType,
        sourceMatchId: input.sourceMatchId ?? null,
        promptSnapshot: { prompt: question.prompt, context: question.context, principle: question.principle },
        optionsSnapshot: question.options,
        selectedOptionId: option.id,
        evaluation: option.evaluation,
        score: option.score,
        rationaleSnapshot: option.feedback,
        evidenceSnapshot: input.evidence == null ? undefined : input.evidence as object,
      },
    });
    const competency = await tx.playerCompetency.update({
      where: { id: existing.id },
      data: {
        mastery,
        confidence,
        evidenceCount,
        correctCount: { increment: option.score >= 0.8 ? 1 : 0 },
        level,
        lastEvidenceAt: now,
        nextReviewAt,
      },
    });
    let all = await tx.playerCompetency.findMany({ where: { profileId: input.profileId } });
    let placementComplete = false;
    let placementAverage = 0;
    if (input.sourceType === 'PLACEMENT') {
      const currentKeys = selectPlacementQuestions(input.placementRole, 10).map((item) => item.key);
      const placementAttempts = await tx.coachQuestionAttempt.findMany({
        where: { profileId: input.profileId, sourceType: 'PLACEMENT', questionKey: { in: currentKeys } },
        select: { competencyKey: true, score: true },
      });
      placementComplete = placementAttempts.length >= currentKeys.length;
      if (placementComplete) {
        placementAverage = placementAttempts.reduce((sum, item) => sum + item.score, 0) / placementAttempts.length;
        // Rebuild from the current placement revision plus genuine later
        // evidence. This keeps immutable legacy answers for audit purposes but
        // prevents an easier, superseded questionnaire from inflating mastery.
        const nonPlacementAttempts = await tx.coachQuestionAttempt.findMany({
          where: { profileId: input.profileId, sourceType: { not: 'PLACEMENT' } },
          select: { competencyKey: true, score: true },
        });
        const scoresByCompetency = new Map<string, number[]>();
        for (const scoredAttempt of [...placementAttempts, ...nonPlacementAttempts]) {
          const scores = scoresByCompetency.get(scoredAttempt.competencyKey) ?? [];
          scores.push(scoredAttempt.score);
          scoresByCompetency.set(scoredAttempt.competencyKey, scores);
        }
        await Promise.all(all.map((item) => {
          const scores = scoresByCompetency.get(item.competencyKey) ?? [];
          const evidenceCount = scores.length + item.appliedCount;
          if (evidenceCount === 0) return Promise.resolve(item);
          const average = (scores.reduce((sum, score) => sum + score, 0) + (item.appliedCount * 0.65)) / evidenceCount;
          const provisionalLevel = average >= 0.75 ? 2 : 1;
          return tx.playerCompetency.update({
            where: { id: item.id },
            data: {
              level: Math.max(item.level, provisionalLevel),
              mastery: average,
              confidence: Math.min(1, evidenceCount / 5),
              evidenceCount,
              correctCount: scores.filter((score) => score >= 0.8).length,
              lastEvidenceAt: now,
            },
          });
        }));
        all = await tx.playerCompetency.findMany({ where: { profileId: input.profileId } });
      }
    }
    const evidenceLevel = Math.floor(all.reduce((sum, item) => sum + item.level, 0) / Math.max(1, all.length));
    const provisionalOverallLevel = placementComplete && placementAverage >= 0.7 ? 2 : 1;
    const overallLevel = Math.max(1, Math.min(5, Math.max(evidenceLevel, provisionalOverallLevel)));
    const totalEvidence = all.reduce((sum, item) => sum + item.evidenceCount, 0);
    await tx.playerLearningProfile.update({
      where: { id: input.profileId },
      data: {
        placementStatus: input.sourceType === 'PLACEMENT' && placementComplete ? 'PROVISIONAL' : undefined,
        overallLevel,
        explanationDepth: overallLevel <= 1 ? 'FOUNDATIONAL' : overallLevel >= 4 ? 'ADVANCED' : 'STANDARD',
        confidence: Math.min(1, totalEvidence / 35),
      },
    });
    return { attempt, competency };
  });

  return {
    questionKey: question.key,
    competencyKey: question.competencyKey,
    competencyLabel: competencyLabel(question.competencyKey),
    evaluation: option.evaluation,
    score: option.score,
    feedback: option.feedback,
    principle: question.principle,
    nextReviewAt: result.competency.nextReviewAt,
  };
}

export function recommendMission(competencies: Array<{ competencyKey: string; mastery: number; level: number }>) {
  const weakest = [...competencies].sort((a, b) => a.mastery - b.mastery || a.level - b.level)[0];
  const template = MISSION_TEMPLATES.find((item) => item.competencyKey === weakest?.competencyKey)
    ?? MISSION_TEMPLATES[0];
  return { ...template, competencyLabel: competencyLabel(template.competencyKey) };
}

export async function getMatchLearningCheckpoint(userId: string, matchId: string, matchPlayerId: string, role?: string | null) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { linkedPlayerId: true } });
  if (!user?.linkedPlayerId) return null;
  const matchPlayer = await db.matchPlayer.findFirst({ where: { id: matchPlayerId, matchId, playerId: user.linkedPlayerId }, select: { playerId: true } });
  if (!matchPlayer) return null;
  const profile = await ensureLearningProfile(userId, matchPlayer.playerId);
  const weakest = [...profile.competencies].sort((a, b) => a.mastery - b.mastery || a.evidenceCount - b.evidenceCount)[0];
  const candidates = LEARNING_QUESTIONS.filter((question) => {
    const roleMatches = !question.roles?.length || question.roles.includes((role ?? profile.activeRole ?? '').toUpperCase());
    return roleMatches && (!weakest || question.competencyKey === weakest.competencyKey);
  });
  const fallback = LEARNING_QUESTIONS.filter((question) => !question.roles?.length || question.roles.includes((role ?? profile.activeRole ?? '').toUpperCase()));
  const question = candidates[0] ?? fallback[0];
  if (!question) return null;
  return {
    profile: { overallLevel: profile.overallLevel, levelLabel: levelLabel(profile.overallLevel), explanationDepth: profile.explanationDepth },
    checkpoint: {
      key: question.key, competencyKey: question.competencyKey, competencyLabel: competencyLabel(question.competencyKey),
      prompt: question.prompt, context: question.context, principle: question.principle,
      options: question.options.map(({ id, text }) => ({ id, text })),
    },
  };
}
