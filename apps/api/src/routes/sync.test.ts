import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { authCookie } from '../test/auth-cookie.js';
import { errorHandler } from '../middleware/error-handler.js';

vi.mock('../db.js', () => ({
  db: {
    user: { findUnique: vi.fn() },
    player: { findUnique: vi.fn() },
    syncLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../services/predgg-token-service.js', () => ({
  getPlatformAccessToken: vi.fn().mockResolvedValue({ accessToken: 'platform-token' }),
}));

vi.mock('../services/sync-service.js', () => ({
  syncRecentMatchesForPlayer: vi.fn().mockResolvedValue({ newMatches: 3, syncedMatches: 47 }),
}));

vi.mock('../services/player-match-enrichment-service.js', () => ({
  getPlayerMatchEnrichmentStatus: vi.fn().mockResolvedValue({
    playerId: 'player-personal', windowDays: 30, totalMatches: 10, rosterSynced: 8,
    eventStreamSynced: 6, fullyEnriched: 6, failed: 1, pending: 4, coveragePercent: 60,
    lastMatchSyncedAt: '2026-08-25T12:00:00.000Z', job: null,
  }),
  startPlayerMatchEnrichment: vi.fn().mockResolvedValue({
    playerId: 'player-personal', windowDays: 30, totalMatches: 10, rosterSynced: 8,
    eventStreamSynced: 6, fullyEnriched: 6, failed: 1, pending: 4, coveragePercent: 60,
    lastMatchSyncedAt: '2026-08-25T12:00:00.000Z',
    job: { running: true, total: 4, processed: 0, succeeded: 0, errors: 0, startedAt: '2026-08-26T10:00:00Z', finishedAt: null },
  }),
}));

import { db } from '../db.js';
import { getPlayerMatchEnrichmentStatus, startPlayerMatchEnrichment } from '../services/player-match-enrichment-service.js';
import { syncRecentMatchesForPlayer } from '../services/sync-service.js';
import { syncRouter } from './sync.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/sync', syncRouter);
app.use(errorHandler);

const mockDb = db as any;

describe('POST /sync/my-matches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('syncs the standalone player linked directly to the account', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-personal' });
    mockDb.player.findUnique.mockResolvedValue({ predggId: 'pred-1', displayName: 'Player One' });
    const cookie = await authCookie({ userId: 'standalone-user', memberships: [] });

    const response = await request(app).post('/sync/my-matches').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.newMatches).toBe(3);
    expect(response.body.syncedMatches).toBe(47);
    expect(syncRecentMatchesForPlayer).toHaveBeenCalledWith(
      mockDb,
      'pred-1',
      'platform-token',
      1000,
    );
    expect(startPlayerMatchEnrichment).toHaveBeenCalledWith(
      mockDb,
      'player-personal',
      'platform-token',
      { userName: 'Player One' },
    );
  });

  it('keeps supporting a player linked through a team membership', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: null });
    mockDb.player.findUnique.mockResolvedValue({ predggId: 'pred-2', displayName: 'Player Two' });
    const cookie = await authCookie({
      userId: 'team-user',
      memberships: [{ teamId: 'team-1', role: 'PLAYER', playerId: 'player-team' }],
    });

    const response = await request(app).post('/sync/my-matches').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(syncRecentMatchesForPlayer).toHaveBeenCalledWith(
      mockDb,
      'pred-2',
      'platform-token',
      1000,
    );
  });

  it('returns a useful error when the account has no linked player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: null });
    const cookie = await authCookie({ userId: 'unlinked-user', memberships: [] });

    const response = await request(app).post('/sync/my-matches').set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NO_PLAYER_LINKED');
    expect(syncRecentMatchesForPlayer).not.toHaveBeenCalled();
  });

  it('reports enrichment coverage only for the linked player', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-personal' });
    mockDb.player.findUnique.mockResolvedValue({ id: 'player-personal', predggId: 'pred-1', displayName: 'Player One' });
    const cookie = await authCookie({ userId: 'coverage-user', memberships: [] });

    const response = await request(app).get('/sync/my-matches/coverage').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.coveragePercent).toBe(60);
    expect(getPlayerMatchEnrichmentStatus).toHaveBeenCalledWith(mockDb, 'player-personal');
  });

  it('starts a personal enrichment job and can explicitly retry failures', async () => {
    mockDb.user.findUnique.mockResolvedValue({ linkedPlayerId: 'player-personal' });
    mockDb.player.findUnique.mockResolvedValue({ id: 'player-personal', predggId: 'pred-1', displayName: 'Player One' });
    const cookie = await authCookie({ userId: 'enrichment-user', memberships: [] });

    const response = await request(app)
      .post('/sync/my-matches/enrich')
      .send({ retryFailed: true })
      .set('Cookie', cookie);

    expect(response.status).toBe(202);
    expect(startPlayerMatchEnrichment).toHaveBeenCalledWith(
      mockDb,
      'player-personal',
      'platform-token',
      { retryFailed: true, userName: 'Player One' },
    );
  });
});
