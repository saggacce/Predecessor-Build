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
  return {
    heroSlug: 'murdock',
    team: 'DAWN',
    kills: 4,
    deaths: 5,
    assists: 6,
    heroDamage: 20_000,
    gold: 12_000,
    laneMinionsKilled: 150,
    match: {
      startTime: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      winningTeam: 'DAWN',
    },
    ...overrides,
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
  });

  it('does not invent a performance conclusion with too few recent matches', async () => {
    mockDb.matchPlayer.findMany.mockResolvedValue([match(2), match(14), match(21)]);

    const report = await generatePlayerWeeklyReport('player-1', NOW);

    expect(report.weekly.matches).toBe(1);
    expect(report.trends.every((item) => item.direction === 'insufficient_data')).toBe(true);
    expect(report.focusOfWeek.category).toBe('activity');
  });
});
