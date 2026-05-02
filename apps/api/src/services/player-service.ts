import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function safeNumber(val: unknown): number {
  return typeof val === 'number' && isFinite(val) ? val : 0;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  isPrivate: boolean;
  inferredRegion: string | null;
  firstSeen: Date;
  lastSynced: Date;
  rating: {
    rankLabel: string | null;
    ratingPoints: number | null;
  } | null;
  generalStats: Record<string, unknown>;
  heroStats: unknown[];
  roleStats: unknown[];
  recentMatches: Array<{
    matchId: string;
    heroSlug: string;
    role: string | null;
    kills: number;
    deaths: number;
    assists: number;
    gold: number | null;
    heroDamage: number | null;
    result: 'win' | 'loss' | 'unknown';
    date: Date;
    duration: number;
    heroName: string | null;
    heroImageUrl: string | null;
  }>;
}

function buildHeroMetaMap(heroStats: unknown): Map<string, { name: string | null; imageUrl: string | null }> {
  const meta = new Map<string, { name: string | null; imageUrl: string | null }>();
  if (!Array.isArray(heroStats)) return meta;

  for (const raw of heroStats) {
    if (!isRecord(raw) || !isRecord(raw.heroData)) continue;
    const slug = typeof raw.heroData.slug === 'string' ? raw.heroData.slug : null;
    if (!slug) continue;

    meta.set(slug, {
      name: typeof raw.heroData.name === 'string' ? raw.heroData.name : null,
      imageUrl: typeof raw.heroData.imageUrl === 'string' ? raw.heroData.imageUrl : null,
    });
  }

  return meta;
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile> {
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      snapshots: {
        orderBy: { syncedAt: 'desc' },
        take: 1,
      },
      matchPlayers: {
        include: {
          match: true,
        },
        orderBy: { match: { startTime: 'desc' } },
        take: 50,
      },
    },
  });

  if (!player) {
    throw new AppError(404, `Player not found: ${playerId}`, 'PLAYER_NOT_FOUND');
  }

  const latestSnapshot = player.snapshots[0] ?? null;
  const heroMeta = buildHeroMetaMap(latestSnapshot?.heroStats);

  const recentMatches = player.matchPlayers.map((mp) => {
    const isWin = mp.match.winningTeam !== null && mp.team === mp.match.winningTeam;
    const isLoss = mp.match.winningTeam !== null && mp.team !== mp.match.winningTeam;
    const hero = heroMeta.get(mp.heroSlug);

    return {
      matchId: mp.match.id,
      heroSlug: mp.heroSlug,
      role: mp.role,
      kills: mp.kills,
      deaths: mp.deaths,
      assists: mp.assists,
      gold: mp.gold,
      heroDamage: mp.heroDamage,
      result: (isWin ? 'win' : isLoss ? 'loss' : 'unknown') as 'win' | 'loss' | 'unknown',
      date: mp.match.startTime,
      duration: mp.match.duration,
      gameMode: mp.match.gameMode,
      heroName: hero?.name ?? null,
      heroImageUrl: hero?.imageUrl ?? null,
    };
  });

  return {
    id: player.id,
    displayName: player.displayName,
    isPrivate: player.isPrivate,
    inferredRegion: player.inferredRegion,
    firstSeen: player.firstSeen,
    lastSynced: player.lastSynced,
    rating: latestSnapshot
      ? {
          rankLabel: latestSnapshot.rankLabel,
          ratingPoints: latestSnapshot.ratingPoints,
        }
      : null,
    generalStats: isRecord(latestSnapshot?.generalStats) ? latestSnapshot.generalStats : {},
    heroStats: Array.isArray(latestSnapshot?.heroStats) ? latestSnapshot.heroStats : [],
    roleStats: Array.isArray(latestSnapshot?.roleStats) ? latestSnapshot.roleStats : [],
    recentMatches,
  };
}

export interface PlayerComparison {
  players: [PlayerProfile, PlayerProfile];
  deltas: {
    stat: string;
    playerA: number;
    playerB: number;
    diff: number;
    advantage: 'A' | 'B' | 'tie';
  }[];
}

export async function comparePlayers(
  playerIdA: string,
  playerIdB: string,
): Promise<PlayerComparison> {
  const [a, b] = await Promise.all([
    getPlayerProfile(playerIdA),
    getPlayerProfile(playerIdB),
  ]);

  const statsA = isRecord(a.generalStats) ? a.generalStats : {};
  const statsB = isRecord(b.generalStats) ? b.generalStats : {};

  // Compare common numeric stats
  const allKeys = new Set([...Object.keys(statsA), ...Object.keys(statsB)]);
  const deltas = Array.from(allKeys)
    .filter((key) => typeof statsA[key] === 'number' && typeof statsB[key] === 'number')
    .map((stat) => {
      const valA = safeNumber(statsA[stat]);
      const valB = safeNumber(statsB[stat]);
      const diff = valA - valB;
      return {
        stat,
        playerA: valA,
        playerB: valB,
        diff,
        advantage: (diff > 0 ? 'A' : diff < 0 ? 'B' : 'tie') as 'A' | 'B' | 'tie',
      };
    });

  return { players: [a, b], deltas };
}

export async function searchPlayers(query: string, limit = 20) {
  return db.player.findMany({
    where: {
      displayName: {
        contains: query,
        mode: 'insensitive',
      },
    },
    orderBy: { lastSynced: 'desc' },
    take: limit,
    select: {
      id: true,
      displayName: true,
      isPrivate: true,
      inferredRegion: true,
      lastSynced: true,
    },
  });
}
