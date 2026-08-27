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
});
