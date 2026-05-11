import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlayerAdvancedMetrics } from './player-service.js';
import { db } from '../db.js';

vi.mock('../db.js', () => ({
  db: {
    player: { findUnique: vi.fn() },
    matchPlayer: { findMany: vi.fn() },
    heroKill: { findMany: vi.fn() },
  },
}));

const mockDb = db as unknown as {
  player: { findUnique: ReturnType<typeof vi.fn> };
  matchPlayer: { findMany: ReturnType<typeof vi.fn> };
  heroKill: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.player.findUnique.mockResolvedValue({ id: 'player-1' });
  mockDb.matchPlayer.findMany.mockReset();
  mockDb.heroKill.findMany.mockResolvedValue([]);
});

describe('getPlayerAdvancedMetrics', () => {
  it('calculates share metrics, efficiency gap and event-stream death rates', async () => {
    mockDb.matchPlayer.findMany
      .mockResolvedValueOnce([
        {
          matchId: 'match-1',
          team: 'BLUE',
          kills: 2,
          gold: 100,
          heroDamage: 300,
          assists: 1,
          match: { winningTeam: 'RED', eventStreamSynced: true, duration: 1800 },
        },
      ])
      .mockResolvedValueOnce([
        { matchId: 'match-1', team: 'BLUE', kills: 2, gold: 100, heroDamage: 300 },
        { matchId: 'match-1', team: 'BLUE', kills: 8, gold: 300, heroDamage: 300 },
        { matchId: 'match-1', team: 'RED', kills: 5, gold: 500, heroDamage: 500 },
      ]);
    mockDb.heroKill.findMany.mockResolvedValue([
      { matchId: 'match-1', gameTime: 120, killedPlayerId: 'player-1', killedTeam: 'BLUE' },
      { matchId: 'match-1', gameTime: 300, killedPlayerId: 'player-2', killedTeam: 'BLUE' },
    ]);

    const result = await getPlayerAdvancedMetrics('player-1');

    expect(result).toMatchObject({
      sampleSize: 1,
      eventStreamSampleSize: 1,
      goldSharePct: 25,
      damageSharePct: 50,
      killSharePct: 20,
      efficiencyGap: 25,
      earlyDeathRate: 1,
      firstDeathRate: 1,
    });
  });

  it('returns empty metrics when the player has no matches', async () => {
    mockDb.matchPlayer.findMany.mockResolvedValueOnce([]);

    const result = await getPlayerAdvancedMetrics('player-1');

    expect(result).toEqual({
      sampleSize: 0,
      eventStreamSampleSize: 0,
      goldSharePct: null,
      damageSharePct: null,
      killSharePct: null,
      efficiencyGap: null,
      earlyDeathRate: null,
      firstDeathRate: null,
    });
  });

  it('keeps death rates null when no matches have event stream data', async () => {
    mockDb.matchPlayer.findMany
      .mockResolvedValueOnce([
        {
          matchId: 'match-1',
          team: 'BLUE',
          kills: 0,
          gold: 0,
          heroDamage: 0,
          assists: 0,
          match: { winningTeam: null, eventStreamSynced: false, duration: 1800 },
        },
      ])
      .mockResolvedValueOnce([
        { matchId: 'match-1', team: 'BLUE', kills: 0, gold: 0, heroDamage: 0 },
      ]);

    const result = await getPlayerAdvancedMetrics('player-1');

    expect(result.eventStreamSampleSize).toBe(0);
    expect(result.goldSharePct).toBeNull();
    expect(result.damageSharePct).toBeNull();
    expect(result.killSharePct).toBeNull();
    expect(result.earlyDeathRate).toBeNull();
    expect(result.firstDeathRate).toBeNull();
  });
});
