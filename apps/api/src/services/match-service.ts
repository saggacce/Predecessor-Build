import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export interface MatchEventKill {
  gameTime: number;
  killerTeam: string | null;
  killedTeam: string | null;
  killerHeroSlug: string | null;
  killedHeroSlug: string | null;
  killerPlayerId: string | null;
  killedPlayerId: string | null;
}

export interface MatchEventObjective {
  gameTime: number;
  entityType: string;
  killerTeam: string | null;
  killerPlayerId: string | null;
  locationX: number | null;
  locationY: number | null;
}

export interface MatchEventStructure {
  gameTime: number;
  structureType: string;
  destructionTeam: string | null;
}

export interface MatchEventWard {
  gameTime: number;
  eventType: string;
  wardType: string;
  team: string | null;
}

export interface MatchEventTransaction {
  gameTime: number;
  transactionType: string;
  itemName: string | null;
  team: string | null;
  playerId: string | null;
}

export interface MatchEvents {
  heroKills: MatchEventKill[];
  objectiveKills: MatchEventObjective[];
  structureDestructions: MatchEventStructure[];
  wardEvents: MatchEventWard[];
  transactions: MatchEventTransaction[];
}

export async function getMatchEvents(matchId: string): Promise<MatchEvents> {
  const match = await db.match.findUnique({ where: { id: matchId }, select: { id: true, eventStreamSynced: true } });
  if (!match) throw new AppError(404, `Match not found: ${matchId}`, 'MATCH_NOT_FOUND');

  const [heroKills, objectiveKills, structureDestructions, wardEvents, transactions] = await Promise.all([
    db.heroKill.findMany({ where: { matchId }, orderBy: { gameTime: 'asc' } }),
    db.objectiveKill.findMany({ where: { matchId }, orderBy: { gameTime: 'asc' } }),
    db.structureDestruction.findMany({ where: { matchId }, orderBy: { gameTime: 'asc' } }),
    db.wardEvent.findMany({ where: { matchId }, orderBy: { gameTime: 'asc' } }),
    db.transaction.findMany({
      where: { matchId, transactionType: { in: ['BUY', 'SELL'] } },
      orderBy: { gameTime: 'asc' },
    }),
  ]);

  return {
    heroKills: heroKills.map((k) => ({
      gameTime: k.gameTime,
      killerTeam: k.killerTeam,
      killedTeam: k.killedTeam,
      killerHeroSlug: k.killerHeroSlug,
      killedHeroSlug: k.killedHeroSlug,
      killerPlayerId: k.killerPlayerId,
      killedPlayerId: k.killedPlayerId,
      locationX: k.locationX,
      locationY: k.locationY,
    })),
    objectiveKills: objectiveKills.map((o) => ({
      gameTime: o.gameTime,
      entityType: o.entityType,
      killerTeam: o.killerTeam,
      killerPlayerId: o.killerPlayerId,
      locationX: o.locationX,
      locationY: o.locationY,
    })),
    structureDestructions: structureDestructions.map((s) => ({
      gameTime: s.gameTime,
      structureType: s.structureType,
      destructionTeam: s.destructionTeam,
      locationX: s.locationX,
      locationY: s.locationY,
    })),
    wardEvents: wardEvents.map((w) => ({
      gameTime: w.gameTime,
      eventType: w.eventType,
      wardType: w.wardType,
      team: w.team,
      locationX: w.locationX,
      locationY: w.locationY,
    })),
    transactions: transactions.map((t) => ({
      gameTime: t.gameTime,
      transactionType: t.transactionType,
      itemName: t.itemName,
      team: t.team,
      playerId: t.playerId,
    })),
  };
}

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
  goldEarnedAtInterval: number[] | null;
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
  rosterSynced: boolean;
  eventStreamSynced: boolean;
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
      predggPlayerUuid: mp.predggPlayerUuid ?? mp.player?.predggId ?? null,
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
      physicalDamageDealtToHeroes: mp.physicalDamageDealtToHeroes,
      magicalDamageDealtToHeroes: mp.magicalDamageDealtToHeroes,
      trueDamageDealtToHeroes: mp.trueDamageDealtToHeroes,
      heroDamageTaken: mp.heroDamageTaken,
      totalDamageTaken: mp.totalDamageTaken,
      totalHealingDone: mp.totalHealingDone,
      totalDamageDealtToStructures: mp.totalDamageDealtToStructures,
      totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives,
      largestCriticalStrike: mp.largestCriticalStrike,
      laneMinionsKilled: mp.laneMinionsKilled,
      goldSpent: mp.goldSpent,
      largestKillingSpree: mp.largestKillingSpree,
      multiKill: mp.multiKill,
      physicalDamageDealt: mp.physicalDamageDealt,
      magicalDamageDealt: mp.magicalDamageDealt,
      trueDamageDealt: mp.trueDamageDealt,
      goldEarnedAtInterval: Array.isArray(mp.goldEarnedAtInterval) ? (mp.goldEarnedAtInterval as number[]) : null,
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
    rosterSynced: match.rosterSynced,
    eventStreamSynced: match.eventStreamSynced,
    dusk,
    dawn,
  };
}
