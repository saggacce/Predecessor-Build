import { beforeEach, describe, expect, it, vi } from 'vitest';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { authCookie } from '../test/auth-cookie.js';
import { errorHandler } from '../middleware/error-handler.js';

const mocks = vi.hoisted(() => ({
  matchFindUnique: vi.fn(),
  getMatchDetail: vi.fn(),
  getMatchEvents: vi.fn(),
  getValidToken: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    match: { findUnique: mocks.matchFindUnique },
    user: { findUnique: vi.fn() },
    matchPlayer: { findFirst: vi.fn() },
  },
}));
vi.mock('../services/match-service.js', () => ({
  getMatchDetail: mocks.getMatchDetail,
  getMatchEvents: mocks.getMatchEvents,
}));
vi.mock('./auth.js', () => ({ getValidToken: mocks.getValidToken }));
vi.mock('../services/sync-service.js', () => ({ resyncMatch: vi.fn(), syncMatchEventStream: vi.fn() }));
vi.mock('../services/build-coach-service.js', () => ({ getMatchBuildAnalysis: vi.fn() }));

import { buildLiveDetail, matchesRouter } from './matches.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/matches', matchesRouter);
app.use(errorHandler);

describe('buildLiveDetail', () => {
  it('ignores null and empty inventory slots returned by pred.gg', () => {
    const result = buildLiveDetail({
      match: {
        uuid: 'match-1',
        matchPlayers: [
          {
            player: { id: 'player-1', name: 'Player One' },
            team: 'DUSK',
            hero: { slug: 'murdock' },
            inventoryItemData: [
              null,
              { item: null },
              { item: { slug: '' } },
              { item: { slug: 'lightning-hawk' } },
            ],
          },
        ],
      },
    });

    expect(result.detail.dusk).toHaveLength(1);
    expect(result.detail.dusk[0].inventoryItems).toEqual(['lightning-hawk']);
  });
});

describe('GET /matches/live/:predggUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.matchFindUnique.mockResolvedValue({ id: 'stored-match-1' });
    mocks.getMatchDetail.mockResolvedValue({ id: 'stored-match-1', predggUuid: 'uuid-1', dusk: [], dawn: [] });
    mocks.getMatchEvents.mockResolvedValue({ heroKills: [], objectiveKills: [], structureDestructions: [], wardEvents: [], transactions: [] });
  });

  it('serves a synced local match without depending on the browser Pred.gg token', async () => {
    const cookie = await authCookie({ globalRole: 'PLAYER', memberships: [] });

    const response = await request(app).get('/matches/live/uuid-1').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.detail.id).toBe('stored-match-1');
    expect(mocks.getMatchDetail).toHaveBeenCalledWith('stored-match-1');
    expect(mocks.getMatchEvents).toHaveBeenCalledWith('stored-match-1');
    expect(mocks.getValidToken).not.toHaveBeenCalled();
  });
});
