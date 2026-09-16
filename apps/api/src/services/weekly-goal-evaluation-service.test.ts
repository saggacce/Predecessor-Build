import { describe, expect, it, vi } from 'vitest';
import { calculateGoalMetric, evaluateWeeklyGoals } from './weekly-goal-evaluation-service.js';

function row(overrides: Record<string, unknown> = {}) {
  return {
    team: 'DAWN', kills: 2, deaths: 3, assists: 6, gold: 12_000, heroDamage: 18_000,
    laneMinionsKilled: 150, wardsPlaced: 9, totalDamageDealtToObjectives: 3_000,
    totalDamageDealtToStructures: 2_000,
    match: {
      duration: 1_800,
      winningTeam: 'DAWN',
      matchPlayers: [{ team: 'DAWN', kills: 2 }, { team: 'DAWN', kills: 4 }, { team: 'DAWN', kills: 4 }],
    },
    ...overrides,
  };
}

describe('weekly goal evaluation', () => {
  it('calculates role-aware process metrics from actual match rows', () => {
    const rows = [row(), row({ wardsPlaced: 6 })] as never[];

    expect(calculateGoalMetric('wards_per_min', rows)).toBe(0.25);
    expect(calculateGoalMetric('kill_participation', rows)).toBe(80);
    expect(calculateGoalMetric('deaths_per_match', rows)).toBe(3);
    expect(calculateGoalMetric('custom', rows)).toBeNull();
  });

  it('compares the next five matches with the previous five and marks an achieved target', async () => {
    const createdAt = new Date('2026-08-20T12:00:00Z');
    const current = Array.from({ length: 5 }, () => row({ deaths: 3 }));
    const baseline = Array.from({ length: 5 }, () => row({ deaths: 6 }));
    const db = {
      weeklyGoal: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'goal-1', playerId: null, title: 'Morir menos', metricKey: 'deaths_per_match',
          targetValue: 4, currentValue: 0, status: 'ACTIVE', createdAt,
        }]),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({
          id: 'goal-1', playerId: null, title: 'Morir menos', metricKey: 'deaths_per_match',
          targetValue: 4, currentValue: data.currentValue, status: data.status, createdAt,
        })),
      },
      matchPlayer: {
        findMany: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.match.startTime.gte ? current : baseline)),
      },
    };

    const result = await evaluateWeeklyGoals(db as never, 'user-1', 'player-1', new Date('2026-08-18T00:00:00Z'));

    expect(result[0]).toMatchObject({
      targetMatches: 5,
      matchesTracked: 5,
      metricValue: 3,
      baselineValue: 6,
      outcome: 'target_achieved',
    });
    expect(db.weeklyGoal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', weekStart: expect.any(Date) },
    }));
    expect(db.weeklyGoal.update).toHaveBeenCalledWith({
      where: { id: 'goal-1' },
      data: { currentValue: 3, status: 'ACHIEVED' },
    });
  });
});
