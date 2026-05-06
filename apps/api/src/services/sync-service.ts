/**
 * Sync service — calls pred.gg GraphQL directly and persists to the local DB.
 * No child processes. No external CLI. Called directly from API route handlers.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../logger.js';

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

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
  await db.matchPlayer.deleteMany({ where: { playerId } });

  for (const item of matches) {
    const match = item.match;
    const predggUuid = safeString(match?.id);
    const startTime = safeString(match?.startTime);
    if (!predggUuid || !startTime) continue;

    let versionId: string | null = null;
    const version = match?.version;
    if (version?.id) {
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
        inventoryItems: [],
        perkSlug: null,
      },
    });
  }
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
 * Re-syncs all players whose lastSynced is older than STALE_THRESHOLD_MS.
 */
export async function syncStalePlayers(db: PrismaClient, userToken?: string): Promise<SyncResult> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const stalePlayers = await db.player.findMany({
    where: { lastSynced: { lt: staleThreshold } },
    select: { displayName: true },
  });

  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };

  for (const player of stalePlayers) {
    try {
      const synced = await syncPlayerByName(db, player.displayName, userToken);
      if (synced) result.synced++;
      else result.skipped++;
    } catch {
      result.errors++;
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
        gold wardsPlaced
        hero { slug }
        inventoryItemData { name }
        player { id name }
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
    hero: { slug: string } | null;
    inventoryItemData: Array<{ name: string } | null>;
    player: { id: string; name: string | null } | null;
  }>;
}

export async function resyncMatch(db: PrismaClient, predggUuid: string, userToken?: string): Promise<void> {
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

  for (const mp of data.match.matchPlayers) {
    let playerId: string | null = null;
    if (mp.player?.id) {
      const dbPlayer = await db.player.findUnique({ where: { predggId: mp.player.id } });
      playerId = dbPlayer?.id ?? null;
    }
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
        inventoryItems: mp.inventoryItemData.filter(Boolean).map((i) => i!.name.toLowerCase()),
        perkSlug: null,
        abilityOrder: [],
      },
    });
  }
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

  // Also include matches with HIDDEN players that are missing their predgg UUID
  const missingUuid = await db.match.findMany({
    where: { matchPlayers: { some: { playerName: 'HIDDEN', predggPlayerUuid: null } } },
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
