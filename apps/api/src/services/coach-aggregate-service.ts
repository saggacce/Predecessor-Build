import { Prisma, type PrismaClient } from '@prisma/client';

export type AggregateConfidence = 'low' | 'medium' | 'high';

export interface CoachAggregateFilters {
  heroSlug?: string | null;
  role?: string | null;
  gameMode?: string | null;
  versionId?: string | null;
  minSample?: number;
  limit?: number;
}

type BuildAggregateRow = {
  aggregateKey: string;
  versionId: string | null;
  gameMode: string;
  role: string | null;
  heroSlug: string;
  buildItems: unknown;
  matches: number;
  wins: number;
  kda: number | null;
  averageHeroDamage: number | null;
  averageGold: number | null;
  lastSeenAt: Date;
};

type MatchupAggregateRow = {
  aggregateKey: string;
  versionId: string | null;
  gameMode: string;
  role: string | null;
  heroSlug: string;
  opponentHeroSlug: string;
  matches: number;
  wins: number;
  kda: number | null;
  averageHeroDamage: number | null;
  lastSeenAt: Date;
};

type IntervalAggregateRow = {
  aggregateKey: string;
  playerId: string;
  intervalStart: Date;
  gameMode: string;
  role: string | null;
  heroSlug: string;
  matches: number;
  wins: number;
  kda: number | null;
  gpm: number | null;
  dpm: number | null;
  csPerMinute: number | null;
  deathsPerMatch: number | null;
};

function confidence(matches: number): AggregateConfidence {
  if (matches >= 30) return 'high';
  if (matches >= 10) return 'medium';
  return 'low';
}

function winRate(wins: number, matches: number): number {
  return matches > 0 ? Math.round((wins / matches) * 1_000) / 10 : 0;
}

function optionalFilter(column: Prisma.Sql, value: string | null | undefined): Prisma.Sql {
  return value ? Prisma.sql`AND ${column} = ${value}` : Prisma.empty;
}

export async function refreshCoachAggregates(db: PrismaClient): Promise<{ refreshed: string[] }> {
  const views = ['CoachBuildAggregate', 'CoachMatchupAggregate', 'CoachPlayerIntervalAggregate'];
  for (const view of views) {
    try {
      await db.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('materialized view is not populated')) throw error;
      await db.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW "${view}"`);
    }
  }
  return { refreshed: views };
}

export async function getCoachAggregates(
  db: PrismaClient,
  playerId: string,
  filters: CoachAggregateFilters = {},
) {
  const minSample = Math.max(1, filters.minSample ?? 3);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 12));
  const gameMode = filters.gameMode ?? 'RANKED';

  const [builds, matchups, intervals] = await Promise.all([
    db.$queryRaw<BuildAggregateRow[]>(Prisma.sql`
      SELECT * FROM "CoachBuildAggregate"
      WHERE matches >= ${minSample}
        ${optionalFilter(Prisma.sql`"heroSlug"`, filters.heroSlug)}
        ${optionalFilter(Prisma.sql`role`, filters.role)}
        ${optionalFilter(Prisma.sql`"gameMode"`, gameMode)}
        ${optionalFilter(Prisma.sql`"versionId"`, filters.versionId)}
      ORDER BY matches DESC, wins::double precision / NULLIF(matches, 0) DESC
      LIMIT ${limit}
    `),
    db.$queryRaw<MatchupAggregateRow[]>(Prisma.sql`
      SELECT * FROM "CoachMatchupAggregate"
      WHERE matches >= ${minSample}
        ${optionalFilter(Prisma.sql`"heroSlug"`, filters.heroSlug)}
        ${optionalFilter(Prisma.sql`role`, filters.role)}
        ${optionalFilter(Prisma.sql`"gameMode"`, gameMode)}
        ${optionalFilter(Prisma.sql`"versionId"`, filters.versionId)}
      ORDER BY matches DESC, wins::double precision / NULLIF(matches, 0) DESC
      LIMIT ${limit}
    `),
    db.$queryRaw<IntervalAggregateRow[]>(Prisma.sql`
      SELECT * FROM "CoachPlayerIntervalAggregate"
      WHERE "playerId" = ${playerId}
        ${optionalFilter(Prisma.sql`"heroSlug"`, filters.heroSlug)}
        ${optionalFilter(Prisma.sql`role`, filters.role)}
        ${optionalFilter(Prisma.sql`"gameMode"`, gameMode)}
      ORDER BY "intervalStart" DESC
      LIMIT ${limit}
    `),
  ]);

  return {
    source: 'riftline_local' as const,
    disclosure: 'Estadísticas calculadas con partidas almacenadas por RiftLine; no son datos globales de pred.gg.',
    filters: { heroSlug: filters.heroSlug ?? null, role: filters.role ?? null, gameMode, versionId: filters.versionId ?? null, minSample },
    builds: builds.map((row) => ({
      ...row,
      buildItems: Array.isArray(row.buildItems) ? row.buildItems : [],
      winRate: winRate(row.wins, row.matches),
      confidence: confidence(row.matches),
    })),
    matchups: matchups.map((row) => ({
      ...row,
      winRate: winRate(row.wins, row.matches),
      confidence: confidence(row.matches),
    })),
    intervals: intervals.map((row) => ({
      ...row,
      winRate: winRate(row.wins, row.matches),
      confidence: confidence(row.matches),
    })),
  };
}
