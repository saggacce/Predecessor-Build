/**
 * Sync service — calls pred.gg GraphQL directly and persists to the local DB.
 * No child processes. No external CLI. Called directly from API route handlers.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../logger.js';
import { syncHeroMeta } from './hero-meta-service.js';

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const STALE_SYNC_BATCH   = 30;   // max players per "Sync Players" click
const STALE_CONCURRENCY  = 5;    // concurrent pred.gg calls within the batch

async function predggQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  userToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // User OAuth token takes priority — unlocks player data
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
  else if (API_KEY) headers['X-Api-Key'] = API_KEY;

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`pred.gg HTTP ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncedPlayer {
  id: string;
  predggId: string;
  displayName: string;
  isPrivate: boolean;
  inferredRegion: string | null;
  lastSynced: Date;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

// ── Player sync ───────────────────────────────────────────────────────────────

interface PredggPlayerResult {
  id: string;
  uuid: string;
  name: string;
  blockSearch: boolean;
}

interface PredggRating {
  points?: number | null;
  rank?: { name?: string | null; tierName?: string | null } | null;
}

interface PredggStatisticResult {
  matchesPlayed?: number | null;
  matchesWon?: number | null;
  doubleKills?: number | null;
  tripleKills?: number | null;
  quadraKills?: number | null;
  pentaKills?: number | null;
  maxKills?: number | null;
  maxAssists?: number | null;
  maxDeaths?: number | null;
  maxGold?: number | null;
  maxHeroDamage?: number | null;
  maxHeroDamageTaken?: number | null;
  maxDuration?: number | null;
}

interface PredggHeroStat {
  hero?: {
    slug?: string | null;
    name?: string | null;
    data?: {
      displayName?: string | null;
      icon?: string | null;
      promoIcon?: string | null;
      defaultSkin?: {
        icon?: string | null;
        portrait?: string | null;
        smallPortrait?: string | null;
      } | null;
    } | null;
  } | null;
  matchesPlayed?: number | null;
  matchesWon?: number | null;
  totalKills?: number | null;
  totalDeaths?: number | null;
  totalAssists?: number | null;
  totalHeroDamage?: number | null;
  totalGold?: number | null;
}

interface PredggRoleStat {
  role?: string | null;
  matchesPlayed?: number | null;
  matchesWon?: number | null;
  totalKills?: number | null;
  totalDeaths?: number | null;
  totalAssists?: number | null;
  totalHeroDamage?: number | null;
  totalGold?: number | null;
}

interface PredggMatchStat {
  id?: string | null;
  role?: string | null;
  team?: string | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  gold?: number | null;
  heroDamage?: number | null;
  totalDamageDealt?: number | null;
  wardsPlaced?: number | null;
  wardsDestroyed?: number | null;
  laneMinionsKilled?: number | null;
  hero?: {
    slug?: string | null;
    name?: string | null;
    data?: {
      displayName?: string | null;
      icon?: string | null;
      promoIcon?: string | null;
      defaultSkin?: {
        icon?: string | null;
        portrait?: string | null;
        smallPortrait?: string | null;
      } | null;
    } | null;
  } | null;
  match?: {
    id?: string | null;
    startTime?: string | null;
    duration?: number | null;
    gameMode?: string | null;
    region?: string | null;
    winningTeam?: string | null;
    version?: {
      id?: string | null;
      name?: string | null;
      gameString?: string | null;
      releaseDate?: string | null;
      patchType?: string | null;
    } | null;
  } | null;
}

interface PredggPlayerDetail {
  id: string;
  uuid?: string | null;
  name: string;
  blockSearch?: boolean | null;
  favRole?: string | null;
  firstPlayedAt?: string | null;
  lastPlayedAt?: string | null;
  favHero?: {
    slug?: string | null;
    name?: string | null;
    data?: {
      displayName?: string | null;
      icon?: string | null;
      promoIcon?: string | null;
      defaultSkin?: {
        icon?: string | null;
        portrait?: string | null;
        smallPortrait?: string | null;
      } | null;
    } | null;
  } | null;
  ratings?: PredggRating[] | null;
  generalStatistic?: { result?: PredggStatisticResult | null } | null;
  heroStatistics?: { results?: PredggHeroStat[] | null } | null;
  roleStatistics?: { results?: PredggRoleStat[] | null } | null;
  matchesPaginated?: { results?: PredggMatchStat[] | null } | null;
}

interface PlayerSnapshotPayload {
  rankLabel: string | null;
  ratingPoints: number | null;
  generalStats: Prisma.InputJsonObject;
  heroStats: Prisma.InputJsonArray;
  roleStats: Prisma.InputJsonArray;
}

const PLAYER_SEARCH_QUERY = `
  query SearchPlayer($name: String!) {
    playersPaginated(filter: { search: $name }, limit: 1) {
      results { id uuid name blockSearch }
    }
  }
`;

const PLAYER_DETAIL_QUERY = `
  query PlayerDetail($playerId: ID!, $matchLimit: Int!) {
    player(by: { id: $playerId }) {
      id
      uuid
      name
      blockSearch
      favRole
      firstPlayedAt
      lastPlayedAt
      favHero {
        slug
        name
        data { displayName icon promoIcon defaultSkin { icon portrait smallPortrait } }
      }
      ratings {
        points
        rank { name tierName }
      }
      generalStatistic(filter: {}) {
        result {
          matchesPlayed
          matchesWon
          doubleKills
          tripleKills
          quadraKills
          pentaKills
          maxKills
          maxAssists
          maxDeaths
          maxGold
          maxHeroDamage
          maxHeroDamageTaken
          maxDuration
        }
      }
      heroStatistics(filter: {}) {
        results {
          hero {
            slug
            name
            data { displayName icon promoIcon defaultSkin { icon portrait smallPortrait } }
          }
          matchesPlayed
          matchesWon
          totalKills
          totalDeaths
          totalAssists
          totalHeroDamage
          totalGold
        }
      }
      roleStatistics(filter: {}) {
        results {
          role
          matchesPlayed
          matchesWon
          totalKills
          totalDeaths
          totalAssists
          totalHeroDamage
          totalGold
        }
      }
      matchesPaginated(limit: $matchLimit) {
        results {
          id
          role
          team
          kills
          deaths
          assists
          gold
          heroDamage
          totalDamageDealt
          wardsPlaced
          wardsDestroyed
          laneMinionsKilled
          hero {
            slug
            name
            data { displayName icon promoIcon defaultSkin { icon portrait smallPortrait } }
          }
          match {
            id
            startTime
            duration
            gameMode
            region
            winningTeam
            version { id name gameString releaseDate patchType }
          }
        }
      }
    }
  }
`;

function safeNumber(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : 0;
}

function safeString(val: unknown): string | null {
  return typeof val === 'string' && val.length > 0 ? val : null;
}

function pickHeroImage(hero: PredggHeroStat['hero'] | PredggMatchStat['hero'] | PredggPlayerDetail['favHero']): string | null {
  return (
    safeString(hero?.data?.defaultSkin?.smallPortrait) ??
    safeString(hero?.data?.defaultSkin?.portrait) ??
    safeString(hero?.data?.defaultSkin?.icon) ??
    safeString(hero?.data?.promoIcon) ??
    safeString(hero?.data?.icon)
  );
}

function pct(wins: number, matches: number): number {
  return matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return numerator;
  return Math.round((numerator / denominator) * 100) / 100;
}

function buildPlayerSnapshot(detail: PredggPlayerDetail | null): PlayerSnapshotPayload {
  if (!detail) {
    return { rankLabel: null, ratingPoints: null, generalStats: {}, heroStats: [], roleStats: [] };
  }

  const rating = detail.ratings?.find((r) => typeof r.points === 'number') ?? detail.ratings?.[0] ?? null;
  const general = detail.generalStatistic?.result ?? {};

  const heroStats = (detail.heroStatistics?.results ?? [])
    .map((stat) => {
      const matches = safeNumber(stat.matchesPlayed);
      const wins = safeNumber(stat.matchesWon);
      const losses = Math.max(matches - wins, 0);
      const heroSlug = safeString(stat.hero?.slug) ?? 'unknown';
      const heroName = safeString(stat.hero?.data?.displayName) ?? safeString(stat.hero?.name) ?? heroSlug;

      return {
        heroData: { slug: heroSlug, name: heroName, imageUrl: pickHeroImage(stat.hero) },
        matches,
        wins,
        losses,
        winRate: pct(wins, matches),
        kills: safeNumber(stat.totalKills),
        deaths: safeNumber(stat.totalDeaths),
        assists: safeNumber(stat.totalAssists),
        heroDamage: safeNumber(stat.totalHeroDamage),
        gold: safeNumber(stat.totalGold),
      };
    })
    .filter((stat) => stat.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  const roleStats = (detail.roleStatistics?.results ?? [])
    .map((stat) => {
      const matches = safeNumber(stat.matchesPlayed);
      const wins = safeNumber(stat.matchesWon);

      return {
        role: safeString(stat.role) ?? 'UNKNOWN',
        matches,
        wins,
        losses: Math.max(matches - wins, 0),
        winRate: pct(wins, matches),
        kills: safeNumber(stat.totalKills),
        deaths: safeNumber(stat.totalDeaths),
        assists: safeNumber(stat.totalAssists),
        heroDamage: safeNumber(stat.totalHeroDamage),
        gold: safeNumber(stat.totalGold),
      };
    })
    .filter((stat) => stat.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  const totals = heroStats.reduce(
    (acc, stat) => ({
      kills: acc.kills + stat.kills,
      deaths: acc.deaths + stat.deaths,
      assists: acc.assists + stat.assists,
      heroDamage: acc.heroDamage + stat.heroDamage,
      gold: acc.gold + stat.gold,
    }),
    { kills: 0, deaths: 0, assists: 0, heroDamage: 0, gold: 0 },
  );

  const matches = safeNumber(general.matchesPlayed) || heroStats.reduce((sum, stat) => sum + stat.matches, 0);
  const wins = safeNumber(general.matchesWon) || heroStats.reduce((sum, stat) => sum + stat.wins, 0);
  const losses = Math.max(matches - wins, 0);

  const generalStats = {
    matches,
    wins,
    losses,
    winRate: pct(wins, matches),
    kills: totals.kills,
    deaths: totals.deaths,
    assists: totals.assists,
    kda: ratio(totals.kills + totals.assists, Math.max(totals.deaths, 1)),
    heroDamage: totals.heroDamage,
    gold: totals.gold,
    doubleKills: safeNumber(general.doubleKills),
    tripleKills: safeNumber(general.tripleKills),
    quadraKills: safeNumber(general.quadraKills),
    pentaKills: safeNumber(general.pentaKills),
    maxKills: safeNumber(general.maxKills),
    maxAssists: safeNumber(general.maxAssists),
    maxDeaths: safeNumber(general.maxDeaths),
    maxGold: safeNumber(general.maxGold),
    maxHeroDamage: safeNumber(general.maxHeroDamage),
    maxHeroDamageTaken: safeNumber(general.maxHeroDamageTaken),
    maxDuration: safeNumber(general.maxDuration),
    favRole: detail.favRole ?? null,
    favHero: detail.favHero
      ? {
          slug: safeString(detail.favHero.slug),
          name: safeString(detail.favHero.data?.displayName) ?? safeString(detail.favHero.name),
          imageUrl: pickHeroImage(detail.favHero),
        }
      : null,
    firstPlayedAt: detail.firstPlayedAt ?? null,
    lastPlayedAt: detail.lastPlayedAt ?? null,
  };

  return {
    rankLabel: rating?.rank?.name ?? rating?.rank?.tierName ?? null,
    ratingPoints: typeof rating?.points === 'number' ? rating.points : null,
    generalStats: generalStats as Prisma.InputJsonObject,
    heroStats: heroStats as Prisma.InputJsonArray,
    roleStats: roleStats as Prisma.InputJsonArray,
  };
}

function inferRegion(matches: PredggMatchStat[]): string | null {
  const counts = new Map<string, number>();
  for (const item of matches) {
    const region = safeString(item.match?.region);
    if (!region) continue;
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [region, count] of counts) {
    if (count > bestCount) {
      best = region;
      bestCount = count;
    }
  }
  return best;
}

async function fetchPlayerDetail(playerId: string, userToken?: string): Promise<PredggPlayerDetail | null> {
  const data = await predggQuery<{ player: PredggPlayerDetail | null }>(
    PLAYER_DETAIL_QUERY,
    { playerId, matchLimit: 50 },
    userToken,
  );
  return data?.player ?? null;
}

async function persistRecentMatches(
  db: PrismaClient,
  playerId: string,
  playerName: string,
  matches: PredggMatchStat[],
  syncedAt: Date,
): Promise<void> {
  // Cache version IDs to avoid one DB round-trip per match for the same patch
  const versionCache = new Map<string, string>();

  // Process all matches concurrently (DB upserts are safe in parallel)
  await Promise.allSettled(matches.map(async (item) => {
    const match = item.match;
    const predggUuid = safeString(match?.id);
    const startTime = safeString(match?.startTime);
    if (!predggUuid || !startTime) return;

    let versionId: string | null = null;
    const version = match?.version;
    if (version?.id) {
      if (versionCache.has(version.id)) {
        versionId = versionCache.get(version.id)!;
      } else {
        const releaseDate = safeString(version.releaseDate);
        const savedVersion = await db.version.upsert({
          where: { predggId: version.id },
          update: {
            name: version.name ?? version.gameString ?? 'Unknown',
            patchType: version.patchType ?? 'UNKNOWN',
            syncedAt,
          },
          create: {
            predggId: version.id,
            name: version.name ?? version.gameString ?? 'Unknown',
            releaseDate: releaseDate ? new Date(releaseDate) : new Date(0),
            patchType: version.patchType ?? 'UNKNOWN',
            syncedAt,
          },
        });
        versionId = savedVersion.id;
        versionCache.set(version.id, versionId);
      }
    }

    const savedMatch = await db.match.upsert({
      where: { predggUuid },
      update: {
        startTime: new Date(startTime),
        duration: safeNumber(match?.duration),
        gameMode: match?.gameMode ?? 'UNKNOWN',
        region: match?.region ?? null,
        winningTeam: match?.winningTeam ?? null,
        versionId,
        syncedAt,
      },
      create: {
        predggUuid,
        startTime: new Date(startTime),
        duration: safeNumber(match?.duration),
        gameMode: match?.gameMode ?? 'UNKNOWN',
        region: match?.region ?? null,
        winningTeam: match?.winningTeam ?? null,
        versionId,
        syncedAt,
      },
    });

    try {
      await db.matchPlayer.create({
        data: {
          matchId: savedMatch.id,
          playerId,
          playerName,
          team: item.team ?? 'UNKNOWN',
          role: item.role ?? null,
          heroSlug: item.hero?.slug ?? 'unknown',
          kills: safeNumber(item.kills),
          deaths: safeNumber(item.deaths),
          assists: safeNumber(item.assists),
          heroDamage: item.heroDamage ?? null,
          totalDamage: item.totalDamageDealt ?? null,
          gold: item.gold ?? null,
          wardsPlaced: item.wardsPlaced ?? null,
          wardsDestroyed: item.wardsDestroyed ?? null,
          laneMinionsKilled: item.laneMinionsKilled ?? null,
          inventoryItems: [],
          perkSlug: null,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
      // P2002 = unique constraint — match already synced for this player, skip
    }
  }));
}

/**
 * Fetches a player by name from pred.gg and upserts into local DB.
 * Returns the synced player record, or null if not found on pred.gg.
 */
export async function syncPlayerByName(
  db: PrismaClient,
  name: string,
  userToken?: string,
): Promise<SyncedPlayer | null> {
  const start = Date.now();
  logger.info({ name }, 'syncing player from pred.gg');

  let data: { playersPaginated: { results: PredggPlayerResult[] } };
  try {
    data = await predggQuery<{ playersPaginated: { results: PredggPlayerResult[] } }>(
      PLAYER_SEARCH_QUERY,
      { name },
      userToken,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // pred.gg requires user-level OAuth to search players by name.
    // Return a clear 503 so the UI can show a meaningful message.
    if (message === 'Forbidden') {
      logger.warn({ name }, 'pred.gg player search requires OAuth — not available server-side');
      await db.syncLog.create({
        data: { entity: 'player', entityId: name, operation: 'fetch', status: 'error', error: 'pred.gg auth required' },
      });
      throw new AppError(
        503,
        'pred.gg requires user authentication to search players. This feature will be available once OAuth login is implemented.',
        'PREDGG_AUTH_REQUIRED',
      );
    }
    logger.error({ name, err }, 'pred.gg query failed');
    await db.syncLog.create({
      data: { entity: 'player', entityId: name, operation: 'fetch', status: 'error', error: message },
    });
    throw err;
  }

  const p = data?.playersPaginated?.results?.[0];

  if (!p) {
    logger.info({ name, elapsed: Date.now() - start }, 'player not found on pred.gg');
    await db.syncLog.create({
      data: { entity: 'player', entityId: name, operation: 'fetch', status: 'skipped', error: 'not found' },
    });
    return null;
  }

  const now = new Date();
  const isPrivate = p.blockSearch || p.name === 'HIDDEN';

  let detail: PredggPlayerDetail | null = null;
  try {
    detail = await fetchPlayerDetail(p.id, userToken);
  } catch (err) {
    logger.warn({ name, predggId: p.id, err }, 'pred.gg player detail query failed; storing basic player only');
  }

  const detailMatches = detail?.matchesPaginated?.results ?? [];
  const inferredRegion = inferRegion(detailMatches);
  const snapshot = buildPlayerSnapshot(detail);

  const player = await db.player.upsert({
    where: { predggId: p.id },
    update: {
      displayName: detail?.name ?? p.name,
      isPrivate: detail?.blockSearch ?? isPrivate,
      inferredRegion,
      lastSynced: now,
    },
    create: {
      predggId: p.id,
      predggUuid: p.uuid ?? p.id,
      displayName: detail?.name ?? p.name,
      isPrivate: detail?.blockSearch ?? isPrivate,
      inferredRegion,
      lastSynced: now,
    },
  });

  await db.playerSnapshot.create({
    data: {
      playerId: player.id,
      syncedAt: now,
      generalStats: snapshot.generalStats,
      heroStats: snapshot.heroStats,
      roleStats: snapshot.roleStats,
      rankLabel: snapshot.rankLabel,
      ratingPoints: snapshot.ratingPoints,
    },
  });

  if (detailMatches.length > 0) {
    await persistRecentMatches(db, player.id, player.displayName, detailMatches, now);
  }

  await db.syncLog.create({
    data: { entity: 'player', entityId: p.id, operation: 'upsert', status: 'ok' },
  });

  logger.info({ name, playerId: player.id, elapsed: Date.now() - start }, 'player synced');

  return {
    id: player.id,
    predggId: p.id,
    displayName: player.displayName,
    isPrivate: player.isPrivate,
    inferredRegion: player.inferredRegion,
    lastSynced: now,
  };
}

/**
 * Re-syncs up to STALE_SYNC_BATCH players whose lastSynced is older than STALE_THRESHOLD_MS.
 * Runs STALE_CONCURRENCY syncs in parallel to keep total time under ~30s.
 */
export async function syncStalePlayers(db: PrismaClient, userToken?: string): Promise<SyncResult & { total: number }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const stalePlayers = await db.player.findMany({
    where: { lastSynced: { lt: staleThreshold }, displayName: { not: 'HIDDEN' } },
    select: { displayName: true },
    orderBy: { lastSynced: 'asc' }, // oldest first
    take: STALE_SYNC_BATCH,
  });

  const total = await db.player.count({ where: { lastSynced: { lt: staleThreshold } } });
  const result: SyncResult & { total: number } = { synced: 0, skipped: 0, errors: 0, total };

  // Process in chunks of STALE_CONCURRENCY
  for (let i = 0; i < stalePlayers.length; i += STALE_CONCURRENCY) {
    const chunk = stalePlayers.slice(i, i + STALE_CONCURRENCY);
    const outcomes = await Promise.allSettled(
      chunk.map((p) => syncPlayerByName(db, p.displayName, userToken))
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value) result.synced++;
        else result.skipped++;
      } else {
        result.errors++;
      }
    }
  }

  logger.info(result, 'stale player sync complete');
  return result;
}

// ── Version sync ─────────────────────────────────────────────────────────────

interface PredggVersion {
  id: string;
  name: string;
  releaseDate: string;
  patchType: string;
}

const VERSIONS_QUERY = `{ versions { id name releaseDate patchType } }`;

/**
 * Fetches all game versions from pred.gg and upserts into local DB.
 */
export async function syncVersionsFromPredgg(db: PrismaClient): Promise<number> {
  const start = Date.now();
  logger.info('syncing versions from pred.gg');

  const data = await predggQuery<{ versions: PredggVersion[] }>(VERSIONS_QUERY);
  const now = new Date();
  let upserted = 0;

  for (const v of data.versions) {
    await db.version.upsert({
      where: { predggId: v.id },
      update: { name: v.name || 'Unknown', patchType: v.patchType || 'UNKNOWN', syncedAt: now },
      create: {
        predggId: v.id,
        name: v.name || 'Unknown',
        releaseDate: new Date(v.releaseDate),
        patchType: v.patchType || 'UNKNOWN',
        syncedAt: now,
      },
    });
    upserted++;
  }

  await db.syncLog.create({
    data: { entity: 'version', entityId: 'all', operation: 'upsert', status: 'ok' },
  });

  // When new versions are detected, refresh hero meta (abilities/stats may change per patch)
  if (upserted > 0) {
    syncHeroMeta(db).catch((err) => logger.warn({ err }, 'hero-meta: background sync failed'));
  }

  logger.info({ upserted, elapsed: Date.now() - start }, 'versions sync complete');
  return upserted;
}

const MATCH_DETAIL_QUERY = `
  query GetMatch($uuid: String!) {
    match(by: { id: $uuid }) {
      id uuid startTime duration gameMode region winningTeam
      version { id }
      matchPlayers {
        name team role kills deaths assists heroDamage totalDamageDealt
        gold wardsPlaced wardsDestroyed level
        physicalDamageDealtToHeroes magicalDamageDealtToHeroes trueDamageDealtToHeroes
        heroDamageTaken totalDamageTaken totalHealingDone
        totalDamageDealtToStructures totalDamageDealtToObjectives
        largestCriticalStrike laneMinionsKilled goldSpent
        largestKillingSpree multiKill
        physicalDamageDealt magicalDamageDealt trueDamageDealt
        hero { slug }
        inventoryItemData { name }
        player { id name isNameConsole }
      }
    }
  }
`;

interface PredggMatchDetail {
  id: string;
  uuid: string;
  startTime: string;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  version: { id: string } | null;
  matchPlayers: Array<{
    name: string | null;
    team: string;
    role: string | null;
    kills: number;
    deaths: number;
    assists: number;
    heroDamage: number | null;
    totalDamageDealt: number | null;
    gold: number | null;
    wardsPlaced: number | null;
    wardsDestroyed: number | null;
    level: number | null;
    physicalDamageDealtToHeroes: number | null;
    magicalDamageDealtToHeroes: number | null;
    trueDamageDealtToHeroes: number | null;
    heroDamageTaken: number | null;
    totalDamageTaken: number | null;
    totalHealingDone: number | null;
    totalDamageDealtToStructures: number | null;
    totalDamageDealtToObjectives: number | null;
    largestCriticalStrike: number | null;
    laneMinionsKilled: number | null;
    goldSpent: number | null;
    largestKillingSpree: number | null;
    multiKill: number | null;
    physicalDamageDealt: number | null;
    magicalDamageDealt: number | null;
    trueDamageDealt: number | null;
    hero: { slug: string } | null;
    inventoryItemData: Array<{ name: string } | null>;
    player: { id: string; name: string | null; isNameConsole: boolean } | null;
  }>;
}

export async function resyncMatch(
  db: PrismaClient,
  predggUuid: string,
  userToken?: string,
  forceRoster = false,
): Promise<void> {
  const existing = await db.match.findUnique({ where: { predggUuid }, select: { id: true, rosterSynced: true, eventStreamSynced: true } });

  // If fully synced and not forced, only run event stream sync if still pending
  if (existing?.rosterSynced && !forceRoster) {
    if (!existing.eventStreamSynced && userToken) {
      await syncMatchEventStream(db, existing.id, predggUuid, userToken);
    }
    logger.info({ predggUuid }, 'match already roster-synced — skipping basic resync');
    return;
  }

  const data = await predggQuery<{ match: PredggMatchDetail | null }>(
    MATCH_DETAIL_QUERY,
    { uuid: predggUuid },
    userToken,
  );

  if (!data.match || !data.match.matchPlayers.length) {
    throw new Error(`Match ${predggUuid} not found or has no players on pred.gg`);
  }

  const match = await db.match.findUnique({ where: { predggUuid } });
  if (!match) throw new Error(`Match ${predggUuid} not in local DB`);

  await db.matchPlayer.deleteMany({ where: { matchId: match.id } });

  const version = data.match.version
    ? await db.version.findUnique({ where: { predggId: data.match.version.id } })
    : null;

  await db.match.update({
    where: { id: match.id },
    data: { syncedAt: new Date(), versionId: version?.id ?? undefined },
  });

  const now = new Date();
  for (const mp of data.match.matchPlayers) {
    let playerId: string | null = null;
    if (mp.player?.id) {
      const isConsole = mp.player.isNameConsole ?? false;
      const displayName = mp.name && mp.name !== 'HIDDEN'
        ? mp.name
        : `user-${mp.player.id.replace(/-/g, '').slice(0, 8)}`;
      // Upsert Player for ALL match participants so customName can be set on any player
      const dbPlayer = await db.player.upsert({
        where: { predggId: mp.player.id },
        create: {
          predggId: mp.player.id,
          predggUuid: mp.player.id,
          displayName,
          isPrivate: false,
          isConsole,
          lastSynced: now,
        },
        update: { isConsole, lastSynced: now },
      });
      playerId = dbPlayer.id;
    }
    try {
    await db.matchPlayer.create({
      data: {
        matchId: match.id,
        playerId,
        predggPlayerUuid: mp.player?.id ?? null,
        playerName: mp.name ?? mp.player?.name ?? 'HIDDEN',
        team: mp.team,
        role: mp.role,
        heroSlug: mp.hero?.slug ?? 'unknown',
        kills: mp.kills,
        deaths: mp.deaths,
        assists: mp.assists,
        heroDamage: mp.heroDamage,
        totalDamage: mp.totalDamageDealt,
        gold: mp.gold,
        wardsPlaced: mp.wardsPlaced,
        wardsDestroyed: mp.wardsDestroyed ?? null,
        level: mp.level ?? null,
        physicalDamageDealtToHeroes: mp.physicalDamageDealtToHeroes ?? null,
        magicalDamageDealtToHeroes: mp.magicalDamageDealtToHeroes ?? null,
        trueDamageDealtToHeroes: mp.trueDamageDealtToHeroes ?? null,
        heroDamageTaken: mp.heroDamageTaken ?? null,
        totalDamageTaken: mp.totalDamageTaken ?? null,
        totalHealingDone: mp.totalHealingDone ?? null,
        totalDamageDealtToStructures: mp.totalDamageDealtToStructures ?? null,
        totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives ?? null,
        largestCriticalStrike: mp.largestCriticalStrike ?? null,
        laneMinionsKilled: mp.laneMinionsKilled ?? null,
        goldSpent: mp.goldSpent ?? null,
        largestKillingSpree: mp.largestKillingSpree ?? null,
        multiKill: mp.multiKill ?? null,
        physicalDamageDealt: mp.physicalDamageDealt ?? null,
        magicalDamageDealt: mp.magicalDamageDealt ?? null,
        trueDamageDealt: mp.trueDamageDealt ?? null,
        inventoryItems: (mp.inventoryItemData ?? []).filter(Boolean).map((i) => i!.name.toLowerCase()),
        perkSlug: null,
        abilityOrder: [],
      },
    });
    } catch (err: unknown) {
      // Skip unique constraint violations from concurrent syncs
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }

  // Mark roster as synced
  await db.match.update({ where: { id: match.id }, data: { rosterSynced: true } });

  // Sync event stream when Bearer token is available
  if (userToken) {
    try {
      await syncMatchEventStream(db, match.id, predggUuid, userToken);
    } catch (err) {
      logger.warn({ matchId: match.id, err }, 'event stream sync failed — basic resync succeeded');
    }
  }
}

// ── Event stream sync ─────────────────────────────────────────────────────────

const MATCH_EVENT_STREAM_QUERY = `
  query GetMatchEventStream($uuid: String!) {
    match(by: { id: $uuid }) {
      heroKills {
        gameTime
        location { x y z }
        killerTeam
        killedTeam
        killerHero { slug }
        killedHero { slug }
        killerPlayer { id }
        killedPlayer { id }
      }
      objectiveKills {
        gameTime
        killedEntityType
        killerTeam
        killerPlayer { id }
        location { x y z }
      }
      structureDestructions {
        gameTime
        structureEntityType
        destructionTeam
        location { x y z }
      }
      heroBans {
        hero { slug }
        team
      }
      matchPlayers {
        player { id }
        team
        goldEarnedAtInterval
        wardPlacements {
          gameTime
          type
          location { x y z }
        }
        wardDestructions {
          gameTime
          type
          location { x y z }
        }
        transactions {
          gameTime
          transactionType
          itemData { name }
        }
      }
    }
  }
`;

interface EventStreamLocation {
  x?: number | null;
  y?: number | null;
  z?: number | null;
}

interface EventStreamMatchData {
  heroKills: Array<{
    gameTime: number;
    location?: EventStreamLocation | null;
    killerTeam?: string | null;
    killedTeam?: string | null;
    killerHero?: { slug?: string | null } | null;
    killedHero?: { slug?: string | null } | null;
    killerPlayer?: { id?: string | null } | null;
    killedPlayer?: { id?: string | null } | null;
  }>;
  objectiveKills: Array<{
    gameTime: number;
    killedEntityType?: string | null;
    killerTeam?: string | null;
    killerPlayer?: { id?: string | null } | null;
    location?: EventStreamLocation | null;
  }>;
  structureDestructions: Array<{
    gameTime: number;
    structureEntityType?: string | null;
    destructionTeam?: string | null;
    location?: EventStreamLocation | null;
  }>;
  heroBans: Array<{
    hero?: { slug?: string | null } | null;
    team?: string | null;
  }>;
  matchPlayers: Array<{
    player?: { id?: string | null } | null;
    team?: string | null;
    goldEarnedAtInterval?: number[] | null;
    wardPlacements?: Array<{
      gameTime: number;
      type?: string | null;
      location?: EventStreamLocation | null;
    }> | null;
    wardDestructions?: Array<{
      gameTime: number;
      type?: string | null;
      location?: EventStreamLocation | null;
    }> | null;
    transactions?: Array<{
      gameTime: number;
      transactionType?: string | null;
      itemData?: { name?: string | null } | null;
    }> | null;
  }>;
}

function collectEventStreamPredggIds(es: EventStreamMatchData): string[] {
  const ids = new Set<string>();

  for (const k of es.heroKills ?? []) {
    if (k.killerPlayer?.id) ids.add(k.killerPlayer.id);
    if (k.killedPlayer?.id) ids.add(k.killedPlayer.id);
  }

  for (const k of es.objectiveKills ?? []) {
    if (k.killerPlayer?.id) ids.add(k.killerPlayer.id);
  }

  for (const mp of es.matchPlayers ?? []) {
    if (mp.player?.id) ids.add(mp.player.id);
  }

  return Array.from(ids);
}

async function resolveEventStreamPlayerIds(
  db: PrismaClient,
  ids: string[],
): Promise<{ playerIdMap: Map<string, string>; placeholdersCreated: number }> {
  if (ids.length === 0) return { playerIdMap: new Map(), placeholdersCreated: 0 };

  const players = await db.player.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { predggId: { in: ids } },
      ],
    },
    select: { id: true, predggId: true },
  });

  const playerIdMap = new Map<string, string>();
  const internalPlayerIds = new Set(players.map((p) => p.id));
  for (const rawId of ids) {
    if (internalPlayerIds.has(rawId)) playerIdMap.set(rawId, rawId);
  }
  for (const player of players) {
    playerIdMap.set(player.predggId, player.id);
  }

  let placeholdersCreated = 0;
  const missing = ids.filter((id) => !playerIdMap.has(id));
  for (const predggId of missing) {
    const placeholder = await db.player.upsert({
      where: { predggId },
      create: {
        predggId,
        predggUuid: predggId,
        displayName: 'Unknown Player',
        lastSynced: new Date(),
      },
      update: {},
      select: { id: true, predggId: true },
    });
    playerIdMap.set(placeholder.predggId, placeholder.id);
    placeholdersCreated++;
  }

  return { playerIdMap, placeholdersCreated };
}

export async function syncMatchEventStream(
  db: PrismaClient,
  matchId: string,
  predggUuid: string,
  userToken: string,
  force = false,
): Promise<void> {
  // Skip if already synced unless forced, to prevent double-insertion
  if (!force) {
    const existing = await db.match.findUnique({ where: { id: matchId }, select: { eventStreamSynced: true } });
    if (existing?.eventStreamSynced) {
      logger.info({ matchId }, 'event stream already synced — skipping');
      return;
    }
  }

  let data: { match: EventStreamMatchData | null };
  try {
    data = await predggQuery<{ match: EventStreamMatchData | null }>(
      MATCH_EVENT_STREAM_QUERY,
      { uuid: predggUuid },
      userToken,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized') || msg.includes('Forbidden')) {
      throw err; // Auth error — let caller handle token refresh
    }
    // API error that won't be fixed by retrying — mark as failed to skip in future runs
    await db.match.update({ where: { id: matchId }, data: { eventStreamFailed: true } }).catch(() => null);
    throw err;
  }

  if (!data.match) {
    // Match no longer exists on pred.gg — mark to skip in future runs
    await db.match.update({ where: { id: matchId }, data: { eventStreamFailed: true } }).catch(() => null);
    throw new Error(`Event stream: match ${predggUuid} not found on pred.gg`);
  }
  const es = data.match;

  // Clear existing event stream data for this match before re-inserting
  await db.$transaction([
    db.heroKill.deleteMany({ where: { matchId } }),
    db.objectiveKill.deleteMany({ where: { matchId } }),
    db.structureDestruction.deleteMany({ where: { matchId } }),
    db.wardEvent.deleteMany({ where: { matchId } }),
    db.transaction.deleteMany({ where: { matchId } }),
    db.heroBan.deleteMany({ where: { matchId } }),
  ]);

  const cuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const { playerIdMap } = await resolveEventStreamPlayerIds(db, collectEventStreamPredggIds(es));
  const toInternalPlayerId = (predggId?: string | null) => predggId ? (playerIdMap.get(predggId) ?? null) : null;

  // Hero kills
  if (es.heroKills?.length) {
    await db.heroKill.createMany({
      data: es.heroKills.map((k) => ({
        id: cuid(),
        matchId,
        gameTime: k.gameTime,
        locationX: k.location?.x ?? null,
        locationY: k.location?.y ?? null,
        locationZ: k.location?.z ?? null,
        killerTeam: k.killerTeam ?? null,
        killedTeam: k.killedTeam ?? null,
        killerHeroSlug: k.killerHero?.slug ?? null,
        killedHeroSlug: k.killedHero?.slug ?? null,
        killerPlayerId: toInternalPlayerId(k.killerPlayer?.id),
        killedPlayerId: toInternalPlayerId(k.killedPlayer?.id),
      })),
    });
  }

  // Objective kills
  if (es.objectiveKills?.length) {
    await db.objectiveKill.createMany({
      data: es.objectiveKills.map((k) => ({
        id: cuid(),
        matchId,
        gameTime: k.gameTime,
        entityType: k.killedEntityType ?? 'UNKNOWN',
        killerTeam: k.killerTeam ?? null,
        killerPlayerId: toInternalPlayerId(k.killerPlayer?.id),
        locationX: k.location?.x ?? null,
        locationY: k.location?.y ?? null,
        locationZ: k.location?.z ?? null,
      })),
    });
  }

  // Structure destructions
  if (es.structureDestructions?.length) {
    await db.structureDestruction.createMany({
      data: es.structureDestructions.map((s) => ({
        id: cuid(),
        matchId,
        gameTime: s.gameTime,
        structureType: s.structureEntityType ?? 'UNKNOWN',
        destructionTeam: s.destructionTeam ?? null,
        locationX: s.location?.x ?? null,
        locationY: s.location?.y ?? null,
        locationZ: s.location?.z ?? null,
      })),
    });
  }

  // Hero bans
  if (es.heroBans?.length) {
    await db.heroBan.createMany({
      data: es.heroBans
        .filter((b) => b.hero?.slug && b.team)
        .map((b) => ({
          id: cuid(),
          matchId,
          heroSlug: b.hero!.slug!,
          team: b.team!,
        })),
    });
  }

  // Per-player events: wards, transactions, gold timeline
  for (const mp of es.matchPlayers ?? []) {
    const predggPlayerId = mp.player?.id ?? null;
    const playerId = toInternalPlayerId(predggPlayerId);
    const team = mp.team ?? null;

    // Ward placements
    if (mp.wardPlacements?.length) {
      await db.wardEvent.createMany({
        data: mp.wardPlacements.map((w) => ({
          id: cuid(),
          matchId,
          gameTime: w.gameTime,
          eventType: 'PLACEMENT',
          wardType: w.type ?? 'UNKNOWN',
          locationX: w.location?.x ?? null,
          locationY: w.location?.y ?? null,
          locationZ: w.location?.z ?? null,
          playerId,
          team,
        })),
      });
    }

    // Ward destructions
    if (mp.wardDestructions?.length) {
      await db.wardEvent.createMany({
        data: mp.wardDestructions.map((w) => ({
          id: cuid(),
          matchId,
          gameTime: w.gameTime,
          eventType: 'DESTRUCTION',
          wardType: w.type ?? 'UNKNOWN',
          locationX: w.location?.x ?? null,
          locationY: w.location?.y ?? null,
          locationZ: w.location?.z ?? null,
          playerId,
          team,
        })),
      });
    }

    // Transactions
    if (mp.transactions?.length) {
      await db.transaction.createMany({
        data: mp.transactions.map((t) => ({
          id: cuid(),
          matchId,
          gameTime: t.gameTime,
          transactionType: t.transactionType ?? 'UNKNOWN',
          itemName: t.itemData?.name ?? null,
          playerId,
          team,
        })),
      });
    }

    // Gold timeline — update the MatchPlayer record
    if (mp.goldEarnedAtInterval?.length && predggPlayerId) {
      await db.matchPlayer.updateMany({
        where: { matchId, predggPlayerUuid: predggPlayerId },
        data: { goldEarnedAtInterval: mp.goldEarnedAtInterval },
      });
    }
  }

  // Mark match as event stream synced
  await db.match.update({
    where: { id: matchId },
    data: { eventStreamSynced: true },
  });

  logger.info({ matchId, predggUuid }, 'event stream synced');
}

export interface EventStreamPlayerIdRepairResult {
  heroKillsUpdated: number;
  objectiveKillsUpdated: number;
  wardEventsUpdated: number;
  placeholdersCreated: number;
}

export async function repairEventStreamPlayerIds(db: PrismaClient): Promise<EventStreamPlayerIdRepairResult> {
  const [heroKills, objectiveKills, wardEvents] = await Promise.all([
    db.heroKill.findMany({
      where: {
        OR: [
          { killerPlayerId: { not: null } },
          { killedPlayerId: { not: null } },
        ],
      },
      select: { id: true, killerPlayerId: true, killedPlayerId: true },
    }),
    db.objectiveKill.findMany({
      where: { killerPlayerId: { not: null } },
      select: { id: true, killerPlayerId: true },
    }),
    db.wardEvent.findMany({
      where: { playerId: { not: null } },
      select: { id: true, playerId: true },
    }),
  ]);

  const rawIds = new Set<string>();
  for (const kill of heroKills) {
    if (kill.killerPlayerId) rawIds.add(kill.killerPlayerId);
    if (kill.killedPlayerId) rawIds.add(kill.killedPlayerId);
  }
  for (const objective of objectiveKills) {
    if (objective.killerPlayerId) rawIds.add(objective.killerPlayerId);
  }
  for (const ward of wardEvents) {
    if (ward.playerId) rawIds.add(ward.playerId);
  }

  const { playerIdMap, placeholdersCreated } = await resolveEventStreamPlayerIds(db, Array.from(rawIds));
  let heroKillsUpdated = 0;
  let objectiveKillsUpdated = 0;
  let wardEventsUpdated = 0;

  for (const kill of heroKills) {
    const killerPlayerId = kill.killerPlayerId ? (playerIdMap.get(kill.killerPlayerId) ?? kill.killerPlayerId) : null;
    const killedPlayerId = kill.killedPlayerId ? (playerIdMap.get(kill.killedPlayerId) ?? kill.killedPlayerId) : null;
    if (killerPlayerId !== kill.killerPlayerId || killedPlayerId !== kill.killedPlayerId) {
      await db.heroKill.update({
        where: { id: kill.id },
        data: { killerPlayerId, killedPlayerId },
      });
      heroKillsUpdated++;
    }
  }

  for (const objective of objectiveKills) {
    const killerPlayerId = objective.killerPlayerId ? (playerIdMap.get(objective.killerPlayerId) ?? objective.killerPlayerId) : null;
    if (killerPlayerId !== objective.killerPlayerId) {
      await db.objectiveKill.update({
        where: { id: objective.id },
        data: { killerPlayerId },
      });
      objectiveKillsUpdated++;
    }
  }

  for (const ward of wardEvents) {
    const playerId = ward.playerId ? (playerIdMap.get(ward.playerId) ?? ward.playerId) : null;
    if (playerId !== ward.playerId) {
      await db.wardEvent.update({
        where: { id: ward.id },
        data: { playerId },
      });
      wardEventsUpdated++;
    }
  }

  await db.syncLog.create({
    data: {
      entity: 'event-stream',
      entityId: 'player-ids',
      operation: 'repair-player-ids',
      status: 'ok',
    },
  });

  return { heroKillsUpdated, objectiveKillsUpdated, wardEventsUpdated, placeholdersCreated };
}

const PLAYER_RECENT_MATCHES_QUERY = `
  query PlayerRecentMatches($playerId: ID!, $limit: Int!) {
    player(by: { id: $playerId }) {
      id
      name
      matchesPaginated(limit: $limit) {
        results {
          id role team kills deaths assists gold heroDamage totalDamageDealt
          wardsPlaced wardsDestroyed laneMinionsKilled
          hero { slug }
          match { id startTime duration gameMode region winningTeam version { id name gameString releaseDate patchType } }
        }
      }
    }
  }
`;

/**
 * Fetches recent matches for a single player (by their pred.gg ID) and persists new ones.
 * Lightweight: no snapshot creation, just match data.
 * Returns the count of newly inserted matches.
 */
export async function syncRecentMatchesForPlayer(
  db: PrismaClient,
  predggId: string,
  userToken: string,
  limit = 20,
): Promise<{ newMatches: number; newMatchUuids: string[] }> {
  const data = await predggQuery<{
    player: { id: string; name: string; matchesPaginated: { results: PredggMatchStat[] } } | null;
  }>(PLAYER_RECENT_MATCHES_QUERY, { playerId: predggId, limit }, userToken);

  if (!data?.player) return { newMatches: 0, newMatchUuids: [] };

  const matches = data.player.matchesPaginated?.results ?? [];
  if (matches.length === 0) return { newMatches: 0, newMatchUuids: [] };

  const player = await db.player.findUnique({ where: { predggId }, select: { id: true, displayName: true } });
  if (!player) return { newMatches: 0, newMatchUuids: [] };

  const candidateUuids = matches.map((m) => m.match?.id).filter(Boolean) as string[];
  const existing = await db.match.findMany({
    where: { predggUuid: { in: candidateUuids } },
    select: { predggUuid: true },
  });
  const existingSet = new Set(existing.map((m) => m.predggUuid));
  const newMatchUuids = candidateUuids.filter((uuid) => !existingSet.has(uuid));

  const now = new Date();
  await persistRecentMatches(db, player.id, player.displayName, matches, now);
  await db.player.update({ where: { predggId }, data: { lastSynced: now } });

  return { newMatches: newMatchUuids.length, newMatchUuids };
}

export async function syncIncompleteMatches(db: PrismaClient): Promise<{ synced: number; errors: number }> {
  const start = Date.now();

  // Find matches with fewer than 10 MatchPlayers (incomplete roster)
  const incomplete = await db.match.findMany({
    where: { matchPlayers: { none: { id: { gt: '' } } } },
    select: { id: true, predggUuid: true, _count: { select: { matchPlayers: true } } },
  });

  const allMatches = await db.match.findMany({
    select: { id: true, predggUuid: true, _count: { select: { matchPlayers: true } } },
    where: { matchPlayers: { some: {} } },
  });

  // Also include matches with players that have a UUID but no linked Player record
  const missingUuid = await db.match.findMany({
    where: { matchPlayers: { some: { predggPlayerUuid: { not: null }, playerId: null } } },
    select: { id: true, predggUuid: true, _count: { select: { matchPlayers: true } } },
  });

  const seen = new Set<string>();
  const toResync = [...incomplete, ...allMatches.filter((m) => m._count.matchPlayers < 10), ...missingUuid]
    .filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

  logger.info({ count: toResync.length }, 'incomplete matches found — resyncing');

  let synced = 0;
  let errors = 0;

  for (const match of toResync) {
    try {
      await resyncMatch(db, match.predggUuid);
      synced++;
    } catch (err) {
      logger.warn({ matchId: match.id, err }, 'failed to resync incomplete match');
      errors++;
    }
  }

  logger.info({ synced, errors, elapsed: Date.now() - start }, 'incomplete matches resync complete');
  return { synced, errors };
}
