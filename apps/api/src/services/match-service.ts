import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export interface MatchPlayerDetail {
  id: string;
  playerId: string | null;
  predggPlayerUuid: string | null;
  playerName: string;
  customName: string | null;
  team: string;
  role: string | null;
  heroSlug: string;
  heroName: string | null;
  heroImageUrl: string | null;
  isConsole: boolean;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  totalDamage: number | null;
  gold: number | null;
  wardsPlaced: number | null;
  wardsDestroyed: number | null;
  level: number | null;
  inventoryItems: string[];
  perkSlug: string | null;
  rankLabel: string | null;
  ratingPoints: number | null;
}

export interface MatchDetail {
  id: string;
  predggUuid: string;
  startTime: Date;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  version: string | null;
  dusk: MatchPlayerDetail[];
  dawn: MatchPlayerDetail[];
}

function buildHeroMeta(heroStats: unknown): Map<string, { name: string; imageUrl: string | null }> {
  const map = new Map<string, { name: string; imageUrl: string | null }>();
  if (!Array.isArray(heroStats)) return map;
  for (const h of heroStats as Array<Record<string, unknown>>) {
    const hd = h.heroData as Record<string, unknown> | null;
    if (!hd?.slug || typeof hd.slug !== 'string') continue;
    if (!map.has(hd.slug)) {
      map.set(hd.slug, {
        name: typeof hd.name === 'string' ? hd.name : hd.slug,
        imageUrl: typeof hd.imageUrl === 'string' ? hd.imageUrl : null,
      });
    }
  }
  return map;
}

export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      version: true,
      matchPlayers: {
        include: {
          player: {
            include: {
              snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: [{ team: 'asc' }, { kills: 'desc' }],
      },
    },
  });

  if (!match) throw new AppError(404, `Match not found: ${matchId}`, 'MATCH_NOT_FOUND');

  // Build hero meta from all player snapshots in this match
  const heroMeta = new Map<string, { name: string; imageUrl: string | null }>();
  for (const mp of match.matchPlayers) {
    const snap = mp.player?.snapshots[0];
    if (!snap) continue;
    for (const [slug, meta] of buildHeroMeta(snap.heroStats)) {
      if (!heroMeta.has(slug)) heroMeta.set(slug, meta);
    }
  }

  function resolvePlayerName(playerName: string, predggPlayerUuid: string | null): string {
    if (playerName !== 'HIDDEN') return playerName;
    // Construct user-XXXX format from UUID (same as pred.gg website)
    if (predggPlayerUuid) return `user-${predggPlayerUuid.replace(/-/g, '').slice(0, 8)}`;
    return 'HIDDEN';
  }

  function toDetail(mp: (typeof match.matchPlayers)[number]): MatchPlayerDetail {
    const snap = mp.player?.snapshots[0] ?? null;
    const hero = heroMeta.get(mp.heroSlug);
    return {
      id: mp.id,
      playerId: mp.playerId,
      predggPlayerUuid: mp.predggPlayerUuid,
      playerName: resolvePlayerName(mp.playerName, mp.predggPlayerUuid),
      customName: mp.player?.customName ?? null,
      team: mp.team,
      role: mp.role,
      heroSlug: mp.heroSlug,
      heroName: hero?.name ?? mp.heroSlug,
      heroImageUrl: `/heroes/${mp.heroSlug}.webp`,
      isConsole: mp.player?.isConsole ?? false,
      kills: mp.kills,
      deaths: mp.deaths,
      assists: mp.assists,
      heroDamage: mp.heroDamage,
      totalDamage: mp.totalDamage,
      gold: mp.gold,
      wardsPlaced: mp.wardsPlaced,
      wardsDestroyed: mp.wardsDestroyed,
      level: mp.level,
      inventoryItems: Array.isArray(mp.inventoryItems) ? (mp.inventoryItems as string[]) : [],
      perkSlug: mp.perkSlug,
      rankLabel: snap?.rankLabel ?? null,
      ratingPoints: snap?.ratingPoints ?? null,
    };
  }

  const allPlayers = match.matchPlayers.map(toDetail);
  const dusk = allPlayers.filter((p) => p.team === 'DUSK');
  const dawn = allPlayers.filter((p) => p.team === 'DAWN');

  return {
    id: match.id,
    predggUuid: match.predggUuid,
    startTime: match.startTime,
    duration: match.duration,
    gameMode: match.gameMode,
    region: match.region,
    winningTeam: match.winningTeam,
    version: match.version?.name ?? null,
    dusk,
    dawn,
  };
}
