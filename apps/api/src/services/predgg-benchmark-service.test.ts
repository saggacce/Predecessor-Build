import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  db: { player: { findUnique: vi.fn().mockResolvedValue({ predggId: 'predgg-player' }) } },
}));

vi.mock('./predgg-token-service.js', () => ({
  getPlatformAccessToken: vi.fn().mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 }),
  readPlatformOAuthStatus: vi.fn().mockResolvedValue({
    requestedScopes: [], grantedScopes: ['profile'], missingScopes: ['hero_leaderboard:read', 'matchup_statistic:read'],
    capabilities: { profile: true, offlineRefresh: true, playerIntervals: false, heroLeaderboard: false, matchupStatistics: false },
    checkedAt: null, error: null,
  }),
}));

import { getPlayerPredggBenchmarks } from './predgg-benchmark-service.js';

describe('pred.gg player benchmarks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const query = JSON.parse(String(init?.body)).query as string;
      if (query.includes('RiftlineRatingDistribution')) {
        return { ok: true, status: 200, json: async () => ({ data: { ratingDistribution: null }, errors: [{ message: 'Forbidden' }] }) };
      }
      return {
        ok: true, status: 200, json: async () => ({ data: {
          player: {
            ratings: [{ points: 250, percentile: 0.42, rating: { id: '12', name: 'Split', startTime: '2026-06-30T12:00:00Z', endTime: null }, rank: { name: 'Bronze', tierName: 'I' } }],
            heroStatistics: { results: [{
              hero: { slug: 'dekker' }, matchesPlayed: 10, matchesWon: 6, totalKills: 10, totalDeaths: 20,
              totalAssists: 80, totalHeroDamage: 100_000, totalGold: 100_000, totalMinionsKilled: 500,
              totalWardsPlaced: 100, totalWardsDestroyed: 10, totalTime: 18_000,
            }] },
          },
          hero: { id: '2', slug: 'dekker', generalStatistic: { result: {
            matchesPlayed: 100, matchesWon: 50, matchesPlayedMirrorless: 98, matchesWonMirrorless: 49,
            totalKills: 100, totalDeaths: 250, totalAssists: 700, heroDamage: 900_000, gold: 950_000,
            totalMinionsKilled: 4_500, wardsPlaced: 850, wardsDestroyed: 90, totalSecondsPlayed: 180_000,
            totalGoldAt15: 700_000, totalEnemyGoldAt15: 710_000, totalFirstTowerTime: 80_000, totalEnemyFirstTowerTime: 78_000,
          } } },
        } }),
      };
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('compares personal metrics while degrading locked capabilities independently', async () => {
    const result = await getPlayerPredggBenchmarks('player-1', { heroSlug: 'dekker', role: 'SUPPORT', gameMode: 'RANKED' });

    expect(result.benchmark.available).toBe(true);
    expect('comparison' in result.benchmark && result.benchmark.comparison.find((metric) => metric.key === 'winRate')).toMatchObject({ player: 60, population: 50, delta: 10 });
    expect(result.specialists).toMatchObject({ available: false, reason: 'Falta el permiso hero_leaderboard:read.' });
    expect(result.matchups).toMatchObject({ available: false, reason: 'Falta el permiso matchup_statistic:read.' });
    expect(result.ratingDistribution).toMatchObject({ available: false, reason: 'Pred.gg no ha concedido acceso a la distribución de rango.' });
  });
});
