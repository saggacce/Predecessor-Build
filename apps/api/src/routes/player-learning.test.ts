import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { authCookie } from '../test/auth-cookie.js';
import { errorHandler } from '../middleware/error-handler.js';

vi.mock('../db.js', () => ({
  db: {
    user: { findUnique: vi.fn() },
    matchPlayer: { findFirst: vi.fn(), count: vi.fn() },
    playerLearningMomentReview: { findMany: vi.fn(), upsert: vi.fn() },
    playerTrainingCycle: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    playerLearningProfile: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    playerCompetency: { createMany: vi.fn(), updateMany: vi.fn() },
    coachQuestionAttempt: { findMany: vi.fn(), findFirst: vi.fn() },
    playerReplaySession: { create: vi.fn(), findMany: vi.fn() },
    playerReplayMarker: { findFirst: vi.fn(), update: vi.fn() },
    liveTrainingSession: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    liveTrainingEvent: { create: vi.fn() },
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
    expect(response.body.questions).toHaveLength(10);
    expect(response.body.questions.every((question: { key: string }) => question.key.startsWith('placement-v2-'))).toBe(true);
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
    mockDb.playerTrainingCycle.findMany.mockResolvedValue([{ competencyKey: 'macro' }]);
    const cookie = await authCookie({ userId: 'user-1', globalRole: 'PLAYER', memberships: [] });
    const response = await request(app).get('/player-learning/promotion').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ eligible: true, competency: { key: 'macro', currentLevel: 1 } });
    expect(response.body.question.options[0]).not.toHaveProperty('score');
    expect(response.body.question.options[0]).not.toHaveProperty('evaluation');
  });
});
