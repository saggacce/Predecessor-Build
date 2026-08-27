import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getCoachAggregates, refreshCoachAggregates } from './coach-aggregate-service.js';

describe('coach aggregates', () => {
  it('labels local samples and exposes their confidence', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{
        aggregateKey: 'build-1', versionId: 'v1', gameMode: 'RANKED', role: 'SUPPORT', heroSlug: 'dekker',
        buildItems: ['dynamo'], matches: 35, wins: 21, kda: 2.4, averageHeroDamage: 12_000, averageGold: 9_000,
        lastSeenAt: new Date('2026-08-20T00:00:00Z'),
      }])
      .mockResolvedValueOnce([{
        aggregateKey: 'matchup-1', versionId: 'v1', gameMode: 'RANKED', role: 'SUPPORT', heroSlug: 'dekker',
        opponentHeroSlug: 'narbash', matches: 12, wins: 5, kda: 1.8, averageHeroDamage: 9_000,
        lastSeenAt: new Date('2026-08-20T00:00:00Z'),
      }])
      .mockResolvedValueOnce([{
        aggregateKey: 'interval-1', playerId: 'player-1', intervalStart: new Date('2026-08-17T00:00:00Z'),
        gameMode: 'RANKED', role: 'SUPPORT', heroSlug: 'dekker', matches: 4, wins: 2, kda: 2,
        gpm: 280, dpm: 350, csPerMinute: 1.2, deathsPerMatch: 4.5,
      }]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

    const result = await getCoachAggregates(db, 'player-1', { heroSlug: 'dekker', role: 'SUPPORT' });

    expect(result.source).toBe('riftline_local');
    expect(result.builds[0]).toMatchObject({ winRate: 60, confidence: 'high' });
    expect(result.matchups[0]).toMatchObject({ winRate: 41.7, confidence: 'medium' });
    expect(result.intervals[0]).toMatchObject({ winRate: 50, confidence: 'low' });
  });

  it('refreshes all three materialized views', async () => {
    const executeRawUnsafe = vi.fn().mockResolvedValue(0);
    const db = { $executeRawUnsafe: executeRawUnsafe } as unknown as PrismaClient;

    await expect(refreshCoachAggregates(db)).resolves.toEqual({
      refreshed: ['CoachBuildAggregate', 'CoachMatchupAggregate', 'CoachPlayerIntervalAggregate'],
    });
    expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it('uses a blocking first refresh for an unpopulated view', async () => {
    const executeRawUnsafe = vi.fn()
      .mockRejectedValueOnce(new Error('materialized view is not populated'))
      .mockResolvedValue(0);
    const db = { $executeRawUnsafe: executeRawUnsafe } as unknown as PrismaClient;

    await refreshCoachAggregates(db);

    expect(executeRawUnsafe.mock.calls[0][0]).toContain('CONCURRENTLY');
    expect(executeRawUnsafe.mock.calls[1][0]).not.toContain('CONCURRENTLY');
  });
});
