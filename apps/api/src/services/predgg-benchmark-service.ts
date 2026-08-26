import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { getPlatformAccessToken, readPlatformOAuthStatus } from './predgg-token-service.js';

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';

async function gql<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(payload.errors?.map((error) => error.message).join('; ') || `pred.gg HTTP ${response.status}`);
  }
  return payload.data;
}

const BENCHMARK_QUERY = `
  query RiftlinePlayerBenchmark(
    $playerId: ID!, $heroSlug: String!,
    $playerFilter: PlayerHeroStatisticFilterInput,
    $globalFilter: HeroGeneralStatisticFilterInput
  ) {
    player(by: { id: $playerId }) {
      ratings { points percentile rating { id name startTime endTime } rank { name tierName } }
      heroStatistics(filter: $playerFilter) {
        results {
          hero { slug }
          matchesPlayed matchesWon totalKills totalDeaths totalAssists totalHeroDamage totalGold
          totalMinionsKilled totalWardsPlaced totalWardsDestroyed totalTime
        }
      }
    }
    hero(by: { slug: $heroSlug }) {
      id slug
      generalStatistic(filter: $globalFilter) {
        result {
          matchesPlayed matchesWon matchesPlayedMirrorless matchesWonMirrorless
          totalKills totalDeaths totalAssists heroDamage gold totalMinionsKilled wardsPlaced wardsDestroyed totalSecondsPlayed
          totalGoldAt15 totalEnemyGoldAt15 totalFirstTowerTime totalEnemyFirstTowerTime
        }
      }
    }
  }
`;

type Aggregate = {
  matchesPlayed: number; matchesWon: number; totalKills: number; totalDeaths: number; totalAssists: number;
  totalHeroDamage?: number; heroDamage?: number; totalGold?: number; gold?: number;
  totalMinionsKilled: number; totalWardsPlaced?: number; wardsPlaced?: number;
  totalWardsDestroyed?: number; wardsDestroyed?: number; totalTime?: number; totalSecondsPlayed?: number;
};

function round(value: number): number { return Math.round(value * 100) / 100; }
function metrics(row: Aggregate | null | undefined, global = false) {
  if (!row || row.matchesPlayed <= 0) return null;
  const seconds = global ? row.totalSecondsPlayed ?? 0 : row.totalTime ?? 0;
  const minutes = Math.max(seconds / 60, 1);
  return {
    matches: row.matchesPlayed,
    winRate: round((row.matchesWon / row.matchesPlayed) * 100),
    kda: round((row.totalKills + row.totalAssists) / Math.max(row.totalDeaths, 1)),
    damagePerMinute: round((global ? row.heroDamage ?? 0 : row.totalHeroDamage ?? 0) / minutes),
    goldPerMinute: round((global ? row.gold ?? 0 : row.totalGold ?? 0) / minutes),
    csPerMinute: round(row.totalMinionsKilled / minutes),
    wardsPerMatch: round((global ? row.wardsPlaced ?? 0 : row.totalWardsPlaced ?? 0) / row.matchesPlayed),
  };
}

function unavailable(reason: string) { return { available: false as const, reason, results: [] as unknown[] }; }

export async function getPlayerPredggBenchmarks(playerId: string, options: { heroSlug: string; role?: string; gameMode?: string }) {
  const player = await db.player.findUnique({ where: { id: playerId }, select: { predggId: true } });
  if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');
  const token = await getPlatformAccessToken();
  const oauth = await readPlatformOAuthStatus();
  if (!token) {
    return {
      heroSlug: options.heroSlug, role: options.role ?? null, gameMode: options.gameMode ?? null,
      oauth, benchmark: unavailable('Conecta pred.gg para comparar tu rendimiento.'),
      specialists: unavailable('Conecta pred.gg.'), matchups: unavailable('Conecta pred.gg.'),
      ratingDistribution: unavailable('Conecta pred.gg.'),
    };
  }

  const playerFilter = {
    ...(options.role ? { roles: [options.role] } : {}),
    ...(options.gameMode ? { gameModes: [options.gameMode] } : {}),
  };
  const globalFilter = playerFilter;
  const base = await gql<{
    player: { ratings: Array<{ points: number; percentile: number | null; rating: { id: string; name: string; startTime: string; endTime: string | null }; rank: { name: string; tierName: string } | null }>; heroStatistics: { results: Array<Aggregate & { hero: { slug: string } }> } } | null;
    hero: { id: string; slug: string; generalStatistic: { result: (Aggregate & { matchesPlayedMirrorless: number; matchesWonMirrorless: number; totalGoldAt15: number; totalEnemyGoldAt15: number; totalFirstTowerTime: number; totalEnemyFirstTowerTime: number }) | null } | null } | null;
  }>(token.accessToken, BENCHMARK_QUERY, { playerId: player.predggId, heroSlug: options.heroSlug, playerFilter, globalFilter });

  const personalRaw = base.player?.heroStatistics.results.find((row) => row.hero.slug === options.heroSlug) ?? null;
  const globalRaw = base.hero?.generalStatistic?.result ?? null;
  const personal = metrics(personalRaw);
  const population = metrics(globalRaw, true);
  const currentRating = [...(base.player?.ratings ?? [])]
    .filter((rating) => rating.points != null)
    .sort((a, b) => {
      if (a.rating.endTime === null && b.rating.endTime !== null) return -1;
      if (a.rating.endTime !== null && b.rating.endTime === null) return 1;
      return new Date(b.rating.startTime).getTime() - new Date(a.rating.startTime).getTime();
    })[0] ?? null;
  const comparison = personal && population ? (['winRate', 'kda', 'damagePerMinute', 'goldPerMinute', 'csPerMinute', 'wardsPerMatch'] as const).map((key) => ({
    key,
    player: personal[key],
    population: population[key],
    delta: round(personal[key] - population[key]),
  })) : [];

  let specialists: { available: boolean; reason: string | null; results: unknown[] } = oauth.capabilities.heroLeaderboard
    ? { available: true, reason: null, results: [] }
    : unavailable('Falta el permiso hero_leaderboard:read.');
  if (oauth.capabilities.heroLeaderboard && base.hero) {
    try {
      const result = await gql<{ hero: { leaderboard: { results: Array<{ player: { id: string; name: string }; matchesPlayed: number; matchesWon: number; winrate: number }> } | null } | null }>(token.accessToken, `
        query RiftlineHeroSpecialists($heroSlug: String!) {
          hero(by: { slug: $heroSlug }) {
            leaderboard(timeframe: LAST_30_DAYS, scope: NONE, sortBy: MATCHES_PLAYED) {
              results { player { id name } matchesPlayed matchesWon winrate }
            }
          }
        }
      `, { heroSlug: options.heroSlug });
      specialists = { available: true, reason: null, results: result.hero?.leaderboard?.results.slice(0, 10) ?? [] };
    } catch (error) { specialists = unavailable(error instanceof Error ? error.message : 'No disponible'); }
  }

  let matchups: { available: boolean; reason: string | null; results: unknown[] } = oauth.capabilities.matchupStatistics
    ? { available: true, reason: null, results: [] }
    : unavailable('Falta el permiso matchup_statistic:read.');
  if (oauth.capabilities.matchupStatistics && base.hero) {
    try {
      const roleFilter = options.role ? `roles: [${options.role}], matchupRoles: [${options.role}]` : '';
      const modeFilter = options.gameMode ? `gameModes: [${options.gameMode}]` : '';
      const result = await gql<{ hero: { matchupStatistic: { results: Array<{ matchupHero: { slug: string; data: { displayName: string } | null }; matchesPlayed: number; winrate: number; loserate: number; firstTowerTime: number; firstTowerTimeDiff: number }> } | null } | null }>(token.accessToken, `
        query RiftlineHeroMatchups($heroSlug: String!) {
          hero(by: { slug: $heroSlug }) {
            matchupStatistic(filter: { ${[modeFilter, roleFilter].filter(Boolean).join(', ')} }, metric: WINRATE, order: DESC, isAlly: false, sameRole: true) {
              results { matchupHero { slug data { displayName } } matchesPlayed winrate loserate firstTowerTime firstTowerTimeDiff }
            }
          }
        }
      `, { heroSlug: options.heroSlug });
      matchups = { available: true, reason: null, results: result.hero?.matchupStatistic?.results.slice(0, 20) ?? [] };
    } catch (error) { matchups = unavailable(error instanceof Error ? error.message : 'No disponible'); }
  }

  let ratingDistribution: { available: boolean; reason: string | null; results: unknown[] } = unavailable('Pred.gg no ha concedido acceso a la distribución de rating.');
  if (currentRating) {
    try {
      const result = await gql<{ ratingDistribution: { results: Array<{ bucket: number; count: number; rank: { name: string; tierName: string } | null }> } | null }>(token.accessToken, `
        query RiftlineRatingDistribution($ratingId: ID!) {
          ratingDistribution(ratingId: $ratingId, bucketSize: RANK) { results { bucket count rank { name tierName } } }
        }
      `, { ratingId: currentRating.rating.id });
      ratingDistribution = { available: true, reason: null, results: result.ratingDistribution?.results ?? [] };
    } catch (error) {
      ratingDistribution = unavailable(error instanceof Error ? error.message : 'No disponible');
    }
  }

  return {
    heroSlug: options.heroSlug,
    role: options.role ?? null,
    gameMode: options.gameMode ?? null,
    oauth,
    benchmark: {
      available: Boolean(personal && population),
      reason: personal && population ? null : 'No hay muestra suficiente para este héroe y contexto.',
      player: personal,
      population,
      comparison,
      earlyGame: globalRaw ? {
        averageGoldAt15: round(globalRaw.totalGoldAt15 / Math.max(globalRaw.matchesPlayed, 1)),
        averageEnemyGoldAt15: round(globalRaw.totalEnemyGoldAt15 / Math.max(globalRaw.matchesPlayed, 1)),
        averageFirstTowerSeconds: round(globalRaw.totalFirstTowerTime / Math.max(globalRaw.matchesPlayed, 1)),
        averageEnemyFirstTowerSeconds: round(globalRaw.totalEnemyFirstTowerTime / Math.max(globalRaw.matchesPlayed, 1)),
      } : null,
      rating: currentRating,
    },
    specialists,
    matchups,
    ratingDistribution,
  };
}
