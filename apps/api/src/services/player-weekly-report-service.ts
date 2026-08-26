import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type MatchRow = {
  heroSlug: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  gold: number | null;
  laneMinionsKilled: number | null;
  match: { startTime: Date; winningTeam: string | null };
};

export type PlayerPeriodMetrics = {
  matches: number;
  wins: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | null;
  averageHeroDamage: number | null;
  averageGold: number | null;
  averageLaneMinions: number | null;
};

export type PlayerMetricTrend = {
  metric: 'kda' | 'winRate' | 'averageHeroDamage' | 'averageGold' | 'averageLaneMinions';
  weekly: number | null;
  baseline: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'stable' | 'insufficient_data';
  deltaUnit: 'percent' | 'percentage_points';
};

export type PlayerWeeklyReport = {
  generatedAt: string;
  period: { weeklyFrom: string; baselineFrom: string; to: string };
  player: { id: string; displayName: string; customName: string | null };
  weekly: PlayerPeriodMetrics;
  baseline30d: PlayerPeriodMetrics;
  trends: PlayerMetricTrend[];
  topHero: {
    heroSlug: string;
    matches: number;
    wins: number;
    winRate: number;
    shareOfWeeklyMatches: number;
  } | null;
  focusOfWeek: {
    category: 'activity' | 'survivability' | 'consistency' | 'hero_pool' | 'momentum';
    title: string;
    rationale: string;
    action: string;
  };
};

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return rounded(present.reduce((sum, value) => sum + value, 0) / present.length, 1);
}

function aggregate(rows: MatchRow[]): PlayerPeriodMetrics {
  const wins = rows.filter((row) => row.match.winningTeam !== null && row.team === row.match.winningTeam).length;
  const kills = rows.reduce((sum, row) => sum + row.kills, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const assists = rows.reduce((sum, row) => sum + row.assists, 0);

  return {
    matches: rows.length,
    wins,
    winRate: rows.length > 0 ? rounded((wins / rows.length) * 100, 1) : null,
    kills,
    deaths,
    assists,
    kda: rows.length > 0 ? rounded((kills + assists) / Math.max(deaths, 1)) : null,
    averageHeroDamage: average(rows.map((row) => row.heroDamage)),
    averageGold: average(rows.map((row) => row.gold)),
    averageLaneMinions: average(rows.map((row) => row.laneMinionsKilled)),
  };
}

function trend(
  metric: PlayerMetricTrend['metric'],
  weekly: number | null,
  baseline: number | null,
  enoughData: boolean,
): PlayerMetricTrend {
  const points = metric === 'winRate';
  if (!enoughData || weekly === null || baseline === null) {
    return { metric, weekly, baseline, delta: null, direction: 'insufficient_data', deltaUnit: points ? 'percentage_points' : 'percent' };
  }

  const delta = points
    ? rounded(weekly - baseline, 1)
    : baseline === 0 ? null : rounded(((weekly - baseline) / Math.abs(baseline)) * 100, 1);
  if (delta === null) {
    return { metric, weekly, baseline, delta, direction: 'insufficient_data', deltaUnit: points ? 'percentage_points' : 'percent' };
  }

  const threshold = points ? 3 : 5;
  const direction = delta > threshold ? 'up' : delta < -threshold ? 'down' : 'stable';
  return { metric, weekly, baseline, delta, direction, deltaUnit: points ? 'percentage_points' : 'percent' };
}

function topHero(rows: MatchRow[]): PlayerWeeklyReport['topHero'] {
  if (rows.length === 0) return null;
  const heroes = new Map<string, { matches: number; wins: number }>();
  for (const row of rows) {
    const current = heroes.get(row.heroSlug) ?? { matches: 0, wins: 0 };
    current.matches += 1;
    if (row.match.winningTeam !== null && row.team === row.match.winningTeam) current.wins += 1;
    heroes.set(row.heroSlug, current);
  }

  const [heroSlug, stats] = [...heroes.entries()].sort((a, b) => b[1].matches - a[1].matches || b[1].wins - a[1].wins)[0];
  return {
    heroSlug,
    matches: stats.matches,
    wins: stats.wins,
    winRate: rounded((stats.wins / stats.matches) * 100, 1),
    shareOfWeeklyMatches: rounded((stats.matches / rows.length) * 100, 1),
  };
}

function chooseFocus(
  weekly: PlayerPeriodMetrics,
  baseline: PlayerPeriodMetrics,
  hero: PlayerWeeklyReport['topHero'],
): PlayerWeeklyReport['focusOfWeek'] {
  if (weekly.matches < 3) {
    return {
      category: 'activity',
      title: 'Construye una muestra útil',
      rationale: `Solo hay ${weekly.matches} partidas sincronizadas en los últimos 7 días; todavía no es suficiente para separar tendencia de varianza.`,
      action: 'Juega y sincroniza al menos 3–5 partidas antes de cambiar tu plan de entrenamiento.',
    };
  }

  const weeklyDeaths = weekly.deaths / weekly.matches;
  const baselineDeaths = baseline.matches > 0 ? baseline.deaths / baseline.matches : weeklyDeaths;
  if (weeklyDeaths >= baselineDeaths * 1.12 && weeklyDeaths >= 4) {
    return {
      category: 'survivability',
      title: 'Reduce muertes evitables',
      rationale: `Promedias ${rounded(weeklyDeaths, 1)} muertes por partida, por encima de tu referencia de 30 días (${rounded(baselineDeaths, 1)}).`,
      action: 'Revisa la primera muerte de cada partida y anota si faltó visión, información del jungla o respeto por una rotación.',
    };
  }

  if (hero && hero.shareOfWeeklyMatches >= 70 && hero.matches >= 4) {
    return {
      category: 'hero_pool',
      title: 'Añade una segunda opción fiable',
      rationale: `${hero.heroSlug} representa el ${hero.shareOfWeeklyMatches}% de tus partidas semanales. Esa dependencia limita tu adaptación al draft.`,
      action: 'Dedica dos partidas de práctica a un héroe alternativo del mismo rol con un patrón de juego complementario.',
    };
  }

  if (weekly.winRate !== null && baseline.winRate !== null && weekly.winRate >= baseline.winRate + 5) {
    return {
      category: 'momentum',
      title: 'Consolida lo que está funcionando',
      rationale: `Tu win rate semanal es ${weekly.winRate}%, frente al ${baseline.winRate}% de los últimos 30 días.`,
      action: 'Mantén rol y núcleo de héroes una semana más; identifica una decisión repetible de tus victorias y conviértela en hábito.',
    };
  }

  return {
    category: 'consistency',
    title: 'Mejora la consistencia',
    rationale: 'No hay una desviación crítica; el mayor retorno está en repetir buenas decisiones y reducir partidas de bajo impacto.',
    action: 'Elige una métrica de proceso para las próximas cinco partidas: primeras muertes, CS al minuto 10 o participación en objetivos.',
  };
}

export async function generatePlayerWeeklyReport(playerId: string, now = new Date()): Promise<PlayerWeeklyReport> {
  const baselineFrom = new Date(now.getTime() - 30 * DAY_MS);
  const weeklyFrom = new Date(now.getTime() - 7 * DAY_MS);

  const [player, rows] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
      select: { id: true, displayName: true, customName: true },
    }),
    db.matchPlayer.findMany({
      where: { playerId, match: { startTime: { gte: baselineFrom, lte: now } } },
      select: {
        heroSlug: true,
        team: true,
        kills: true,
        deaths: true,
        assists: true,
        heroDamage: true,
        gold: true,
        laneMinionsKilled: true,
        match: { select: { startTime: true, winningTeam: true } },
      },
      orderBy: { match: { startTime: 'desc' } },
    }),
  ]);

  if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

  const typedRows = rows as MatchRow[];
  const weeklyRows = typedRows.filter((row) => row.match.startTime >= weeklyFrom);
  const weekly = aggregate(weeklyRows);
  const baseline30d = aggregate(typedRows);
  const enoughData = weekly.matches >= 3 && baseline30d.matches >= 5;
  const hero = topHero(weeklyRows);

  return {
    generatedAt: now.toISOString(),
    period: { weeklyFrom: weeklyFrom.toISOString(), baselineFrom: baselineFrom.toISOString(), to: now.toISOString() },
    player,
    weekly,
    baseline30d,
    trends: [
      trend('kda', weekly.kda, baseline30d.kda, enoughData),
      trend('winRate', weekly.winRate, baseline30d.winRate, enoughData),
      trend('averageHeroDamage', weekly.averageHeroDamage, baseline30d.averageHeroDamage, enoughData),
      trend('averageGold', weekly.averageGold, baseline30d.averageGold, enoughData),
      trend('averageLaneMinions', weekly.averageLaneMinions, baseline30d.averageLaneMinions, enoughData),
    ],
    topHero: hero,
    focusOfWeek: chooseFocus(weekly, baseline30d, hero),
  };
}
