import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  db: {
    player: { findUnique: vi.fn() },
    matchPlayer: { findMany: vi.fn() },
  },
}));

import { db } from '../db.js';
import { generatePlayerWeeklyReport } from './player-weekly-report-service.js';

const mockDb = db as any;
const NOW = new Date('2026-08-26T12:00:00.000Z');

function match(daysAgo: number, overrides: Record<string, unknown> = {}) {
  const matchOverride = (overrides.match ?? {}) as Record<string, unknown>;
  return {
    heroSlug: 'murdock',
    role: 'CARRY',
    team: 'DAWN',
    kills: 4,
    deaths: 5,
    assists: 6,
    heroDamage: 20_000,
    gold: 12_000,
    laneMinionsKilled: 150,
    wardsPlaced: 8,
    totalDamageDealtToObjectives: 4_000,
    totalDamageDealtToStructures: 3_000,
    totalDamageTaken: 18_000,
    totalHealingDone: 1_000,
    ...overrides,
    match: {
      startTime: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      winningTeam: 'DAWN',
      duration: 1_800,
      matchPlayers: [
        { team: 'DAWN', kills: 4 },
        { team: 'DAWN', kills: 3 },
        { team: 'DAWN', kills: 2 },
        { team: 'DAWN', kills: 1 },
        { team: 'DAWN', kills: 0 },
      ],
      ...matchOverride,
    },
  };
}

describe('generatePlayerWeeklyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.player.findUnique.mockResolvedValue({ id: 'player-1', displayName: 'Carry', customName: null });
  });

  it('compares seven days with 30 days and returns a prescriptive focus', async () => {
    mockDb.matchPlayer.findMany.mockResolvedValue([
      match(1, { deaths: 8 }),
      match(2, { deaths: 7 }),
      match(3, { deaths: 6, match: { startTime: new Date('2026-08-23T12:00:00.000Z'), winningTeam: 'DUSK' } }),
      match(5, { deaths: 7, heroSlug: 'sparrow' }),
      match(12, { deaths: 2 }),
      match(20, { deaths: 2 }),
    ]);

    const report = await generatePlayerWeeklyReport('player-1', NOW);

    expect(report.weekly.matches).toBe(4);
    expect(report.baseline30d.matches).toBe(6);
    expect(report.weekly.winRate).toBe(75);
    expect(report.topHero).toMatchObject({ heroSlug: 'murdock', matches: 3, shareOfWeeklyMatches: 75 });
    expect(report.trends.find((item) => item.metric === 'kda')?.direction).toBe('down');
    expect(report.focusOfWeek.category).toBe('survivability');
    expect(report.roleCoach).toMatchObject({ role: 'CARRY', label: 'Carry' });
  });

  it('does not invent a performance conclusion with too few recent matches', async () => {
    mockDb.matchPlayer.findMany.mockResolvedValue([match(2), match(14), match(21)]);

    const report = await generatePlayerWeeklyReport('player-1', NOW);

    expect(report.weekly.matches).toBe(1);
    expect(report.trends.every((item) => item.direction === 'insufficient_data')).toBe(true);
    expect(report.focusOfWeek.category).toBe('activity');
  });

  it.each([
    ['CARRY', ['csPerMinute', 'goldPerMinute', 'damagePerMinute', 'deathsPerMatch']],
    ['SUPPORT', ['killParticipation', 'wardsPerMinute', 'deathsPerMatch', 'healingPerMinute']],
    ['MIDLANE', ['damagePerMinute', 'csPerMinute', 'killParticipation', 'deathsPerMatch']],
    ['JUNGLE', ['objectiveDamagePerMinute', 'killParticipation', 'damagePerMinute', 'deathsPerMatch']],
    ['OFFLANE', ['damageTakenPerMinute', 'structureDamagePerMinute', 'csPerMinute', 'deathsPerMatch']],
  ])('uses role-specific evidence and actions for %s', async (role, expectedMetrics) => {
    mockDb.matchPlayer.findMany.mockResolvedValue([
      match(1, { role }),
      match(2, { role }),
      match(3, { role }),
      match(4, { role }),
      match(10, { role }),
      match(18, { role }),
    ]);

    const report = await generatePlayerWeeklyReport('player-1', NOW);

    expect(report.roleCoach?.role).toBe(role);
    expect(report.roleCoach?.metrics.map((metric) => metric.key)).toEqual(expectedMetrics);
    expect(report.roleCoach?.focus.title).toBeTruthy();
    expect(report.roleCoach?.focus.action).toBeTruthy();
  });
});
