import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { authCookie } from '../test/auth-cookie.js';
import { errorHandler } from '../middleware/error-handler.js';

vi.mock('../db.js', () => ({
  db: { user: { findUnique: vi.fn() } },
}));

vi.mock('../services/report-service.js', () => ({ generateScrimReport: vi.fn() }));
vi.mock('../services/player-weekly-report-service.js', () => ({
  generatePlayerWeeklyReport: vi.fn().mockResolvedValue({ player: { id: 'player-1' }, weekly: { matches: 4 } }),
}));
vi.mock('../services/player-coach-chat-service.js', () => ({
  answerPlayerCoachQuestion: vi.fn().mockResolvedValue({ answer: 'Respuesta [E2]', evidence: [{ id: 'E2' }] }),
}));
vi.mock('../services/player-build-review-service.js', () => ({
  getPlayerBuildReview: vi.fn().mockResolvedValue({ playerId: 'player-1', matches: [] }),
}));

import { db } from '../db.js';
import { generatePlayerWeeklyReport } from '../services/player-weekly-report-service.js';
import { answerPlayerCoachQuestion } from '../services/player-coach-chat-service.js';
import { getPlayerBuildReview } from '../services/player-build-review-service.js';
import { reportsRouter } from './reports.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/reports', reportsRouter);
app.use(errorHandler);

const mockDb = db as any;

describe('GET /reports/player-weekly/:playerId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the report for the account linked player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ globalRole: 'PLAYER', memberships: [] });

    const response = await request(app).get('/reports/player-weekly/player-1').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(generatePlayerWeeklyReport).toHaveBeenCalledWith('player-1');
  });

  it('does not expose another player report', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ globalRole: 'PLAYER', memberships: [] });

    const response = await request(app).get('/reports/player-weekly/player-2').set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(generatePlayerWeeklyReport).not.toHaveBeenCalled();
  });
});

describe('GET /reports/player-builds/:playerId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns recent build reviews for the linked player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ globalRole: 'PLAYER', memberships: [] });

    const response = await request(app).get('/reports/player-builds/player-1?days=30&limit=3').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(getPlayerBuildReview).toHaveBeenCalledWith('player-1', { days: 30, limit: 3 });
  });

  it('does not expose another player build review', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ globalRole: 'PLAYER', memberships: [] });

    const response = await request(app).get('/reports/player-builds/player-2').set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(getPlayerBuildReview).not.toHaveBeenCalled();
  });
});

describe('POST /reports/player-coach/:playerId/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers only for the account linked player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ userId: 'chat-user', globalRole: 'PLAYER', memberships: [] });

    const response = await request(app)
      .post('/reports/player-coach/player-1/chat')
      .send({ question: '¿Qué debo mejorar?', history: [] })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain('[E2]');
    expect(answerPlayerCoachQuestion).toHaveBeenCalledWith('player-1', 'chat-user', '¿Qué debo mejorar?', []);
  });

  it('rejects chat access to another player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-1' });
    const cookie = await authCookie({ userId: 'chat-denied-user', globalRole: 'PLAYER', memberships: [] });

    const response = await request(app)
      .post('/reports/player-coach/player-2/chat')
      .send({ question: '¿Qué debo mejorar?' })
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(answerPlayerCoachQuestion).not.toHaveBeenCalled();
  });
});
