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

import { db } from '../db.js';
import { generatePlayerWeeklyReport } from '../services/player-weekly-report-service.js';
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
