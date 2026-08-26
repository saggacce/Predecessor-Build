import type { PrismaClient } from '@prisma/client';

const TARGET_MATCHES = 5;

type GoalRow = {
  id: string;
  playerId: string | null;
  title: string;
  metricKey: string;
  targetValue: number | null;
  currentValue: number;
  status: string;
  createdAt: Date;
};

type MatchMetricRow = {
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number | null;
  heroDamage: number | null;
  laneMinionsKilled: number | null;
  wardsPlaced: number | null;
  totalDamageDealtToObjectives: number | null;
  totalDamageDealtToStructures: number | null;
  match: {
    duration: number;
    winningTeam: string | null;
    matchPlayers: Array<{ team: string; kills: number }>;
  };
};

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  return values.length > 0 ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function perMinute(rows: MatchMetricRow[], read: (row: MatchMetricRow) => number | null): number | null {
  return average(rows.flatMap((row) => {
    const value = read(row);
    return value === null || row.match.duration <= 0 ? [] : [value / (row.match.duration / 60)];
  }));
}

export function calculateGoalMetric(metricKey: string, rows: MatchMetricRow[]): number | null {
  if (rows.length === 0) return null;
  if (metricKey === 'winrate') {
    const wins = rows.filter((row) => row.match.winningTeam !== null && row.team === row.match.winningTeam).length;
    return rounded((wins / rows.length) * 100, 1);
  }
  if (metricKey === 'kda') {
    const kills = rows.reduce((sum, row) => sum + row.kills, 0);
    const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
    const assists = rows.reduce((sum, row) => sum + row.assists, 0);
    return rounded((kills + assists) / Math.max(deaths, 1));
  }
  if (metricKey === 'deaths_per_match') return rounded(rows.reduce((sum, row) => sum + row.deaths, 0) / rows.length, 1);
  if (metricKey === 'cs_per_min') return perMinute(rows, (row) => row.laneMinionsKilled);
  if (metricKey === 'gpm') return perMinute(rows, (row) => row.gold);
  if (metricKey === 'dpm') return perMinute(rows, (row) => row.heroDamage);
  if (metricKey === 'wards_per_min') return perMinute(rows, (row) => row.wardsPlaced);
  if (metricKey === 'objective_damage_per_min') return perMinute(rows, (row) => row.totalDamageDealtToObjectives);
  if (metricKey === 'structure_damage_per_min') return perMinute(rows, (row) => row.totalDamageDealtToStructures);
  if (metricKey === 'kill_participation') {
    return average(rows.flatMap((row) => {
      const teamKills = row.match.matchPlayers
        .filter((player) => player.team === row.team)
        .reduce((sum, player) => sum + player.kills, 0);
      return teamKills > 0 ? [Math.min(100, ((row.kills + row.assists) / teamKills) * 100)] : [];
    }));
  }
  return null;
}

function lowerIsBetter(metricKey: string): boolean {
  return metricKey === 'deaths_per_match';
}

function outcomeFor(goal: GoalRow, matches: number, current: number | null, baseline: number | null) {
  if (matches < TARGET_MATCHES) return 'collecting' as const;
  if (current === null) return 'ready_for_review' as const;
  if (goal.targetValue !== null) {
    const achieved = lowerIsBetter(goal.metricKey) ? current <= goal.targetValue : current >= goal.targetValue;
    if (achieved) return 'target_achieved' as const;
  }
  if (baseline === null || baseline === 0) return 'ready_for_review' as const;
  const delta = (current - baseline) / Math.abs(baseline);
  const adjusted = lowerIsBetter(goal.metricKey) ? -delta : delta;
  if (adjusted >= 0.05) return 'improved' as const;
  if (adjusted <= -0.05) return 'declined' as const;
  return 'stable' as const;
}

async function loadMetricRows(
  db: PrismaClient,
  playerId: string,
  createdAt: Date,
): Promise<{ current: MatchMetricRow[]; baseline: MatchMetricRow[] }> {
  const select = {
    team: true,
    kills: true,
    deaths: true,
    assists: true,
    gold: true,
    heroDamage: true,
    laneMinionsKilled: true,
    wardsPlaced: true,
    totalDamageDealtToObjectives: true,
    totalDamageDealtToStructures: true,
    match: {
      select: {
        duration: true,
        winningTeam: true,
        matchPlayers: { select: { team: true, kills: true } },
      },
    },
  } as const;

  const [current, baseline] = await Promise.all([
    db.matchPlayer.findMany({
      where: { playerId, match: { startTime: { gte: createdAt } } },
      select,
      orderBy: { match: { startTime: 'asc' } },
      take: TARGET_MATCHES,
    }),
    db.matchPlayer.findMany({
      where: { playerId, match: { startTime: { lt: createdAt } } },
      select,
      orderBy: { match: { startTime: 'desc' } },
      take: TARGET_MATCHES,
    }),
  ]);
  return { current: current as MatchMetricRow[], baseline: baseline as MatchMetricRow[] };
}

export async function evaluateWeeklyGoals(
  db: PrismaClient,
  userId: string,
  defaultPlayerId: string | null,
  weekStart: Date,
) {
  const goals = await db.weeklyGoal.findMany({
    where: { userId, weekStart },
    orderBy: { createdAt: 'asc' },
  }) as GoalRow[];

  return Promise.all(goals.map(async (goal) => {
    const playerId = goal.playerId ?? defaultPlayerId;
    if (!playerId) {
      return { goal, targetMatches: TARGET_MATCHES, matchesTracked: 0, metricValue: null, baselineValue: null, outcome: 'no_player' as const };
    }
    const rows = await loadMetricRows(db, playerId, goal.createdAt);
    const metricValue = calculateGoalMetric(goal.metricKey, rows.current);
    const baselineValue = calculateGoalMetric(goal.metricKey, rows.baseline);
    return {
      goal,
      targetMatches: TARGET_MATCHES,
      matchesTracked: rows.current.length,
      metricValue,
      baselineValue,
      outcome: outcomeFor(goal, rows.current.length, metricValue, baselineValue),
    };
  }));
}
