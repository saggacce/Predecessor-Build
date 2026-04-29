import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

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
  }>;
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
        take: 20,
      },
    },
  });

  if (!player) {
    throw new AppError(404, `Player not found: ${playerId}`, 'PLAYER_NOT_FOUND');
  }

  const latestSnapshot = player.snapshots[0] ?? null;

  const recentMatches = player.matchPlayers.map((mp) => {
    const isWin = mp.match.winningTeam !== null && mp.team === mp.match.winningTeam;
    const isLoss = mp.match.winningTeam !== null && mp.team !== mp.match.winningTeam;

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
    generalStats: (latestSnapshot?.generalStats as Record<string, unknown>) ?? {},
    heroStats: (latestSnapshot?.heroStats as unknown[]) ?? [],
    roleStats: (latestSnapshot?.roleStats as unknown[]) ?? [],
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

  const statsA = a.generalStats as Record<string, number>;
  const statsB = b.generalStats as Record<string, number>;

  // Compare common numeric stats
  const allKeys = new Set([...Object.keys(statsA), ...Object.keys(statsB)]);
  const deltas = Array.from(allKeys)
    .filter((key) => typeof statsA[key] === 'number' && typeof statsB[key] === 'number')
    .map((stat) => {
      const valA = statsA[stat] ?? 0;
      const valB = statsB[stat] ?? 0;
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
