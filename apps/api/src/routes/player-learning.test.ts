import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { authCookie } from '../test/auth-cookie.js';
import { errorHandler } from '../middleware/error-handler.js';

vi.mock('../db.js', () => ({
  db: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    matchPlayer: { findFirst: vi.fn(), count: vi.fn() },
    playerLearningMomentReview: { findMany: vi.fn(), upsert: vi.fn() },
    playerTrainingCycle: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    playerLearningProfile: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    playerCompetency: { createMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    coachQuestionAttempt: { findMany: vi.fn(), findFirst: vi.fn() },
    playerReplaySession: { create: vi.fn(), findMany: vi.fn() },
    playerReplayMarker: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    liveTrainingSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    liveTrainingEvent: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { db } from '../db.js';
import { playerLearningRouter } from './player-learning.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/player-learning', playerLearningRouter);
app.use(errorHandler);
const mockDb = db as any;

describe('personal learning persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    mockDb.matchPlayer.findFirst.mockResolvedValue({ id: 'mp-1' });
    mockDb.playerLearningProfile.upsert.mockResolvedValue({
      id: 'profile-1', userId: 'user-1', playerId: 'player-1', overallLevel: 1,
      placementStatus: 'NOT_STARTED', activeRole: null, explanationDepth: 'FOUNDATIONAL', confidence: 0,
      competencies: [
        'moba_fundamentals', 'role_knowledge', 'macro', 'micro_concepts', 'builds', 'champion_pool', 'review_autonomy',
      ].map((competencyKey) => ({ competencyKey, level: 1, mastery: 0.25, confidence: 0, evidenceCount: 0 })),
    });
    mockDb.coachQuestionAttempt.findMany.mockResolvedValue([]);
    mockDb.playerReplayMarker.findMany.mockResolvedValue([]);
    mockDb.liveTrainingEvent.findMany.mockResolvedValue([]);
    mockDb.$transaction.mockImplementation(async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb));
  });

  it('stores the player conclusion for a generated replay moment', async () => {
    mockDb.playerLearningMomentReview.upsert.mockResolvedValue({
      id: 'review-1', userId: 'user-1', matchId: 'match-1', matchPlayerId: 'mp-1',
      momentId: 'death-review-300', status: 'CONFIRMED_MISTAKE', note: 'Entré sin información.',
    });
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app)
      .put('/player-learning/matches/match-1/reviews/death-review-300')
      .set('Cookie', cookie)
      .send({ matchPlayerId: 'mp-1', status: 'CONFIRMED_MISTAKE', note: 'Entré sin información.' });
    expect(response.status).toBe(200);
    expect(response.body.review.status).toBe('CONFIRMED_MISTAKE');
    expect(mockDb.playerLearningMomentReview.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_matchId_momentId: { userId: 'user-1', matchId: 'match-1', momentId: 'death-review-300' } },
    }));
  });

  it('serves the current balanced placement revision and marks it in progress', async () => {
    const profile = {
      id: 'profile-1', userId: 'user-1', playerId: 'player-1', overallLevel: 1,
      placementStatus: 'PROVISIONAL', activeRole: 'SUPPORT', explanationDepth: 'FOUNDATIONAL', confidence: 0,
      competencies: [
        'moba_fundamentals', 'role_knowledge', 'macro', 'micro_concepts', 'builds', 'champion_pool', 'review_autonomy',
      ].map((competencyKey) => ({ competencyKey, level: 1, mastery: 0.25, confidence: 0, evidenceCount: 0 })),
    };
    mockDb.playerLearningProfile.upsert.mockResolvedValue(profile);
    mockDb.playerLearningProfile.update.mockResolvedValue({ ...profile, placementStatus: 'IN_PROGRESS' });
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).get('/player-learning/placement').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('IN_PROGRESS');
    expect(response.body.questions).toHaveLength(20);
    expect(response.body.total).toBe(20);
    expect(response.body.questions.every((question: { key: string }) => question.key.startsWith('placement-v3-'))).toBe(true);
    expect(new Set(response.body.questions.map((question: { competencyKey: string }) => question.competencyKey)).size).toBe(7);
  });

  it('rejects reviews for another player', async () => {
    mockDb.matchPlayer.findFirst.mockResolvedValue(null);
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app)
      .put('/player-learning/matches/match-2/reviews/moment-1')
      .set('Cookie', cookie)
      .send({ matchPlayerId: 'mp-other', status: 'INCONCLUSIVE' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('creates one focused five-match cycle and prevents overlapping cycles', async () => {
    mockDb.playerTrainingCycle.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'cycle-active' });
    mockDb.playerTrainingCycle.create.mockResolvedValue({ id: 'cycle-1', targetMatches: 5, status: 'ACTIVE' });
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const payload = { focusKey: 'pre_objective_death', title: 'Llegar vivo al objetivo', cue: 'Comprueba el riesgo 90 segundos antes.', targetMatches: 5 };
    const created = await request(app).post('/player-learning/cycles').set('Cookie', cookie).send(payload);
    expect(created.status).toBe(201);
    expect(created.body.cycle.targetMatches).toBe(5);

    const duplicate = await request(app).post('/player-learning/cycles').set('Cookie', cookie).send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ACTIVE_CYCLE_EXISTS');
  });

  it('creates a private replay review with markers aligned to the recording', async () => {
    mockDb.playerReplaySession.create.mockResolvedValue({ id: 'replay-1', profileId: 'profile-1', markers: [{ gameTime: 600, videoTime: 612 }] });
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).post('/player-learning/replays').set('Cookie', cookie).send({
      matchId: 'match-1', matchPlayerId: 'mp-1', title: 'Revisar Fangtooth', offsetSeconds: 12,
      markers: [{ gameTime: 600, category: 'objective', title: 'Antes de Fangtooth', question: '¿Qué información tenías?' }],
    });
    expect(response.status).toBe(201);
    expect(mockDb.playerReplaySession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ profileId: 'profile-1', status: 'DRAFT' }) }));
  });

  it('blocks ranked before any live capture can become active', async () => {
    mockDb.liveTrainingSession.create.mockImplementation(async ({ data }: any) => ({ id: 'live-1', ...data }));
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).post('/player-learning/live/sessions').set('Cookie', cookie).send({ requestedGameMode: 'RANKED', captureConsent: true });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ canAdvise: false, session: { status: 'BLOCKED', modeVerification: 'BLOCKED_RANKED' } });
  });

  it('keeps live advice disabled until two automatic mode sources agree', async () => {
    const firstSignal = { source: 'screen_ocr', detectedGameMode: 'QUICK', confidence: 0.96, capturedAt: '2026-08-27T12:00:00.000Z' };
    mockDb.liveTrainingSession.findFirst
      .mockResolvedValueOnce({ id: 'live-1', profileId: 'profile-1', modeVerification: 'UNVERIFIED', status: 'PENDING', verificationSignals: null, rankedBlockedAt: null })
      .mockResolvedValueOnce({ id: 'live-1', profileId: 'profile-1', modeVerification: 'UNVERIFIED', status: 'PENDING', verificationSignals: [firstSignal], rankedBlockedAt: null });
    mockDb.liveTrainingSession.update.mockImplementation(async ({ data }: any) => ({ id: 'live-1', ...data }));
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const first = await request(app).post('/player-learning/live/sessions/live-1/verify-mode').set('Cookie', cookie).send({
      detectedGameMode: 'QUICK', signal: { source: 'screen_ocr', confidence: 0.96, capturedAt: firstSignal.capturedAt },
    });
    expect(first.body).toMatchObject({ canAdvise: false, session: { modeVerification: 'UNVERIFIED', status: 'PENDING' } });
    const second = await request(app).post('/player-learning/live/sessions/live-1/verify-mode').set('Cookie', cookie).send({
      detectedGameMode: 'QUICK', signal: { source: 'screen_template', confidence: 0.94, capturedAt: '2026-08-27T12:00:01.000Z' },
    });
    expect(second.body).toMatchObject({ canAdvise: true, session: { modeVerification: 'VERIFIED_ALLOWED', status: 'ACTIVE' } });
  });

  it('delivers a sparse educational cue only from a verified observation', async () => {
    mockDb.liveTrainingSession.findFirst.mockResolvedValue({ id: 'live-1', profileId: 'profile-1', modeVerification: 'VERIFIED_ALLOWED', status: 'ACTIVE' });
    mockDb.liveTrainingEvent.findMany.mockResolvedValue([]);
    mockDb.liveTrainingEvent.create.mockImplementation(async ({ data }: any) => ({ id: 'event-1', ...data }));
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).post('/player-learning/live/sessions/live-1/observations').set('Cookie', cookie).send({
      gameTime: 640,
      eventType: 'RECALL_WINDOW',
      confidence: 0.94,
      observation: {
        competencyKey: 'macro', learningScore: 0.8, rubricId: 'recall-window-v1',
        explanation: 'Oro suficiente, oleada resuelta y sin objetivo inmediato.', detector: 'recall-window-v1',
        inputs: ['gold', 'wave_state', 'objective_timer'], missingInputs: [], capturedAt: '2026-08-27T12:10:00.000Z', inCombat: false,
      },
      candidateAdvice: {
        priority: 'NORMAL', title: 'Ventana de compra', cue: 'Puede ser un buen momento para volver a base.',
        reason: 'Puedes completar una pieza sin abandonar una pelea inmediata.', principle: 'Convierte el oro cuando el coste de volver sea bajo.',
      },
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ delivery: 'SPEAK', advice: { title: 'Ventana de compra' } });
    expect(mockDb.liveTrainingEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ advice: 'Puede ser un buen momento para volver a base.' }) }));
  });

  it('offers a promotion test only after practice and repeated evidence', async () => {
    mockDb.playerLearningProfile.upsert.mockResolvedValue({
      id: 'profile-1', userId: 'user-1', playerId: 'player-1', overallLevel: 1,
      placementStatus: 'PROVISIONAL', activeRole: 'SUPPORT', explanationDepth: 'FOUNDATIONAL', confidence: 0.6,
      competencies: [
        { competencyKey: 'macro', level: 1, mastery: 0.8, confidence: 0.8, evidenceCount: 5 },
        ...['moba_fundamentals', 'role_knowledge', 'micro_concepts', 'builds', 'champion_pool', 'review_autonomy']
          .map((competencyKey) => ({ competencyKey, level: 1, mastery: 0.25, confidence: 0, evidenceCount: 0 })),
      ],
    });
    mockDb.playerTrainingCycle.findMany.mockResolvedValue([{ competencyKey: 'macro', completedAt: new Date('2026-08-26T12:00:00Z') }]);
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).get('/player-learning/promotion').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ eligible: true, competency: { key: 'macro', currentLevel: 1 } });
    expect(response.body.question.options[0]).not.toHaveProperty('score');
    expect(response.body.question.options[0]).not.toHaveProperty('evaluation');
  });

  it('returns a source-aware learning history for profile charts', async () => {
    mockDb.coachQuestionAttempt.findMany.mockResolvedValue([{ id: 'a1', competencyKey: 'macro', sourceType: 'PLACEMENT', evaluation: 'ADEQUATE', score: 1, answeredAt: new Date('2026-08-20T12:00:00Z') }]);
    mockDb.playerTrainingCycle.findMany.mockResolvedValue([]);
    mockDb.playerReplayMarker.findMany.mockResolvedValue([]);
    mockDb.liveTrainingEvent.findMany.mockResolvedValue([]);
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).get('/player-learning/progress/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.summary.totalEvidence).toBe(1);
    expect(response.body.timeline[0]).toMatchObject({ competencyKey: 'macro', source: 'PLACEMENT', confidence: 'DECLARED' });
  });

  it('requires enough practice and a reflection before a mission can count as applied evidence', async () => {
    mockDb.playerTrainingCycle.findFirst.mockResolvedValue({
      id: 'cycle-1', userId: 'user-1', playerId: 'player-1', profileId: 'profile-1', competencyKey: 'macro',
      status: 'ACTIVE', targetMatches: 3, startedAt: new Date('2026-08-20T12:00:00Z'), completedAt: null,
    });
    mockDb.matchPlayer.count.mockResolvedValue(3);
    mockDb.playerTrainingCycle.update.mockResolvedValue({ id: 'cycle-1', status: 'COMPLETED' });
    mockDb.playerCompetency.findUnique.mockResolvedValue({ id: 'competency-1', mastery: 0.65, confidence: 0.6, evidenceCount: 4 });
    mockDb.playerCompetency.update.mockResolvedValue({ id: 'competency-1' });
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).patch('/player-learning/cycles/cycle-1').set('Cookie', cookie).send({
      status: 'COMPLETED', evaluation: { outcome: 'PARTIAL', reflection: 'Detecté las ventanas, pero reaccioné tarde en dos partidas.' },
    });
    expect(response.status).toBe(200);
    expect(mockDb.playerCompetency.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'competency-1' }, data: expect.objectContaining({ appliedCount: { increment: 1 }, evidenceCount: { increment: 1 } }),
    }));
  });
});
