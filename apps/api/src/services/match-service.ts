/**
 * @fileoverview Match service — reads match detail and event stream data from the DB.
 *
 * Two main responsibilities:
 * 1. `getMatchDetail` — assembles the full match scoreboard (both teams, per-player stats,
 *    rank labels, hero metadata) from MatchPlayer + PlayerSnapshot records.
 * 2. `getMatchEvents` — returns the raw event stream (kills, objectives, wards, transactions)
 *    used by the Timeline and Analysis tabs. Requires eventStreamSynced=true on the Match.
 *
 * Data flow: pred.gg → sync-service → DB → match-service → matches route → frontend
 */

import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

// ── Event stream shapes ───────────────────────────────────────────────────────
// These interfaces map directly from DB rows to the API response.
// gameTime is always in seconds from match start.

/** A hero kill event. killerPlayerId / killedPlayerId are internal Player.id values. */
export interface MatchEventKill {
  gameTime: number;
  /** "DUSK" | "DAWN" | null */
  killerTeam: string | null;
  killedTeam: string | null;
  killerHeroSlug: string | null;
  killedHeroSlug: string | null;
  /** Internal Player.id — may be null for players with no pred.gg account */
  killerPlayerId: string | null;
  killedPlayerId: string | null;
  locationX: number | null;
  locationY: number | null;
}

/** An objective secured (Fangtooth, Prime, Shaper, buffs, etc.) */
export interface MatchEventObjective {
  gameTime: number;
  /** Entity type — see ObjectiveKill model in schema.prisma for valid values */
  entityType: string;
  killerTeam: string | null;
  killerPlayerId: string | null;
  locationX: number | null;
  locationY: number | null;
}

/** A structure destroyed (tower, inhibitor, or core) */
export interface MatchEventStructure {
  gameTime: number;
  /** "OUTER_TOWER" | "INNER_TOWER" | "INHIBITOR" | "CORE" */
  structureType: string;
  /** Team that destroyed it — not the team that owned it */
  destructionTeam: string | null;
  locationX: number | null;
  locationY: number | null;
}

/** A ward placement or destruction event */
export interface MatchEventWard {
  gameTime: number;
  /** "PLACEMENT" | "DESTRUCTION" */
  eventType: string;
  /** "STEALTH" | "ORACLE" | "SENTRY" | "SONAR_DRONE" | "SOLSTONE_DRONE" */
  wardType: string;
  playerId: string | null;
  team: string | null;
  locationX: number | null;
  locationY: number | null;
}

/** An item transaction. Only BUY and SELL are included (UNDO_BUY/SELL filtered out). */
export interface MatchEventTransaction {
  gameTime: number;
  /** "BUY" | "SELL" */
  transactionType: string;
  /** PascalCase item name from pred.gg — convert to lowercase for asset slugs */
  itemName: string | null;
  team: string | null;
  playerId: string | null;
}

/** Complete event stream for a match, used by Timeline and Analysis tabs. */
export interface MatchEvents {
  heroKills: MatchEventKill[];
  objectiveKills: MatchEventObjective[];
  structureDestructions: MatchEventStructure[];
  wardEvents: MatchEventWard[];
  transactions: MatchEventTransaction[];
}

/**
 * Fetches all event stream data for a match from the DB.
 * Events are sorted chronologically (gameTime asc).
 * Only BUY/SELL transactions are returned — UNDO_* entries are excluded.
 *
 * @throws {AppError} 404 if the match does not exist
 */
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
      playerId: w.playerId,
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

// ── Match detail shapes ───────────────────────────────────────────────────────

/**
 * Per-player data for the match scoreboard.
 * Combines MatchPlayer stats, Player profile (customName, isConsole, rank),
 * and hero metadata resolved from the latest PlayerSnapshot.
 */
export interface MatchPlayerDetail {
  /** Internal MatchPlayer.id */
  id: string;
  /** Internal Player.id — null if player has no pred.gg account */
  playerId: string | null;
  /** pred.gg player UUID — used to link back to pred.gg profiles */
  predggPlayerUuid: string | null;
  /** Resolved display name. Falls back to "user-XXXXXXXX" for HIDDEN players. */
  playerName: string;
  /** Staff-set override name — takes priority over playerName in the UI */
  customName: string | null;
  /** "DUSK" | "DAWN" */
  team: string;
  role: string | null;
  heroSlug: string;
  /** Hero display name resolved from PlayerSnapshot.heroStats */
  heroName: string | null;
  /** Always "/heroes/{heroSlug}.webp" — served from public assets */
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
  /** Final level at end of match */
  level: number | null;
  /** Lowercase item slugs matching /items/*.webp filenames */
  inventoryItems: string[];
  /** @deprecated Always null — use perks instead */
  perkSlug: string | null;
  /** Current loadout: hero augment, Eternal and two minor blessings. */
  perks: Array<{
    id: string; name: string; displayName: string; slot: string | null;
    icon?: string | null; simpleDescription?: string | null; description?: string | null;
    unlockLevel?: number | null; eternalCategory?: { id: string; name: string } | null;
  }> | null;
  abilityOrder: Array<{ ability: string; gameTime: number }> | null;
  /** From the most recent PlayerSnapshot — e.g. "Diamond III" */
  rankLabel: string | null;
  ratingPoints: number | null;
  physicalDamageDealtToHeroes: number | null;
  magicalDamageDealtToHeroes: number | null;
  trueDamageDealtToHeroes: number | null;
  heroDamageTaken: number | null;
  totalDamageTaken: number | null;
  totalHealingDone: number | null;
  crestHealingDone: number | null;
  itemHealingDone: number | null;
  utilityHealingDone: number | null;
  totalShieldingReceived: number | null;
  totalDamageMitigated: number | null;
  physicalDamageTaken: number | null;
  magicalDamageTaken: number | null;
  trueDamageTaken: number | null;
  physicalDamageTakenFromHeroes: number | null;
  magicalDamageTakenFromHeroes: number | null;
  trueDamageTakenFromHeroes: number | null;
  totalDamageDealtToStructures: number | null;
  totalDamageDealtToObjectives: number | null;
  largestCriticalStrike: number | null;
  /** CS — lane minions only, excludes jungle camps */
  laneMinionsKilled: number | null;
  minionsKilled: number | null;
  neutralMinionsKilled: number | null;
  neutralMinionsTeamJungle: number | null;
  neutralMinionsEnemyJungle: number | null;
  goldSpent: number | null;
  largestKillingSpree: number | null;
  multiKill: number | null;
  physicalDamageDealt: number | null;
  magicalDamageDealt: number | null;
  trueDamageDealt: number | null;
  matchRating: {
    ratingId: string | null; points: number | null; newPoints: number | null; delta: number | null;
    rankName: string | null; tierName: string | null; isRankup: boolean | null;
  } | null;
  /** Cumulative gold per minute array — requires event stream sync */
  goldEarnedAtInterval: number[] | null;
}

/**
 * Full match detail returned by GET /matches/:id.
 * Players are split into dusk/dawn teams, ordered by kills desc.
 */
export interface MatchDetail {
  id: string;
  predggUuid: string;
  startTime: Date;
  endTime: Date | null;
  /** Duration in seconds */
  duration: number;
  /** "RANKED" | "ARAM" | "BRAWL" | "STANDARD" */
  gameMode: string;
  region: string | null;
  /** "DUSK" | "DAWN" | null */
  winningTeam: string | null;
  endReason: string | null;
  spoilerBlockedUntil: Date | null;
  /** Patch name string e.g. "0.19.2", null if version not resolved */
  version: string | null;
  rosterSynced: boolean;
  eventStreamSynced: boolean;
  dusk: MatchPlayerDetail[];
  dawn: MatchPlayerDetail[];
}

/**
 * Builds a slug→{name, imageUrl} lookup from a PlayerSnapshot.heroStats JSON blob.
 * Used to resolve hero names and images without a separate DB query.
 */
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

/**
 * Fetches a complete match detail from the DB, including all 10 players,
 * their stats, rank labels (from latest snapshot), and hero metadata.
 *
 * Hero metadata is resolved from the PlayerSnapshot.heroStats of players in this match
 * — no separate HeroMeta lookup needed for basic name/image resolution.
 *
 * @throws {AppError} 404 if the match does not exist
 */
export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      version: true,
      matchPlayers: {
        include: {
          player: {
            include: {
              // Only the most recent snapshot — used for rank label and hero meta
              snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 },
            },
          },
        },
        // DUSK first, then sorted by kills descending within each team
        orderBy: [{ team: 'asc' }, { kills: 'desc' }],
      },
    },
  });

  if (!match) throw new AppError(404, `Match not found: ${matchId}`, 'MATCH_NOT_FOUND');

  // Aggregate hero meta from all snapshots present in this match
  const heroMeta = new Map<string, { name: string; imageUrl: string | null }>();
  for (const mp of match.matchPlayers) {
    const snap = mp.player?.snapshots[0];
    if (!snap) continue;
    for (const [slug, meta] of buildHeroMeta(snap.heroStats)) {
      if (!heroMeta.has(slug)) heroMeta.set(slug, meta);
    }
  }

  /**
   * Resolves the display name for a player.
   * "HIDDEN" players (no pred.gg account or private profile) are displayed
   * as "user-XXXXXXXX" derived from their UUID — matching pred.gg's own convention.
   */
  function resolvePlayerName(playerName: string, predggPlayerUuid: string | null): string {
    if (playerName !== 'HIDDEN') return playerName;
    if (predggPlayerUuid) return `user-${predggPlayerUuid.replace(/-/g, '').slice(0, 8)}`;
    return 'HIDDEN';
  }

  /** Maps a DB MatchPlayer row to the MatchPlayerDetail API shape. */
  type LoadedMatch = NonNullable<typeof match>;
  function toDetail(mp: LoadedMatch['matchPlayers'][number]): MatchPlayerDetail {
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
      perks: Array.isArray(mp.perks) ? (mp.perks as MatchPlayerDetail['perks']) : null,
      abilityOrder: Array.isArray(mp.abilityOrder) ? (mp.abilityOrder as Array<{ ability: string; gameTime: number }>) : null,
      rankLabel: snap?.rankLabel ?? null,
      ratingPoints: snap?.ratingPoints ?? null,
      physicalDamageDealtToHeroes: mp.physicalDamageDealtToHeroes,
      magicalDamageDealtToHeroes: mp.magicalDamageDealtToHeroes,
      trueDamageDealtToHeroes: mp.trueDamageDealtToHeroes,
      heroDamageTaken: mp.heroDamageTaken,
      totalDamageTaken: mp.totalDamageTaken,
      totalHealingDone: mp.totalHealingDone,
      crestHealingDone: mp.crestHealingDone,
      itemHealingDone: mp.itemHealingDone,
      utilityHealingDone: mp.utilityHealingDone,
      totalShieldingReceived: mp.totalShieldingReceived,
      totalDamageMitigated: mp.totalDamageMitigated,
      physicalDamageTaken: mp.physicalDamageTaken,
      magicalDamageTaken: mp.magicalDamageTaken,
      trueDamageTaken: mp.trueDamageTaken,
      physicalDamageTakenFromHeroes: mp.physicalDamageTakenFromHeroes,
      magicalDamageTakenFromHeroes: mp.magicalDamageTakenFromHeroes,
      trueDamageTakenFromHeroes: mp.trueDamageTakenFromHeroes,
      totalDamageDealtToStructures: mp.totalDamageDealtToStructures,
      totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives,
      largestCriticalStrike: mp.largestCriticalStrike,
      laneMinionsKilled: mp.laneMinionsKilled,
      minionsKilled: mp.minionsKilled,
      neutralMinionsKilled: mp.neutralMinionsKilled,
      neutralMinionsTeamJungle: mp.neutralMinionsTeamJungle,
      neutralMinionsEnemyJungle: mp.neutralMinionsEnemyJungle,
      goldSpent: mp.goldSpent,
      largestKillingSpree: mp.largestKillingSpree,
      multiKill: mp.multiKill,
      physicalDamageDealt: mp.physicalDamageDealt,
      magicalDamageDealt: mp.magicalDamageDealt,
      trueDamageDealt: mp.trueDamageDealt,
      matchRating: mp.ratingId || mp.ratingPoints != null || mp.ratingNewPoints != null ? {
        ratingId: mp.ratingId,
        points: mp.ratingPoints,
        newPoints: mp.ratingNewPoints,
        delta: mp.ratingDelta,
        rankName: mp.ratingRankName,
        tierName: mp.ratingTierName,
        isRankup: mp.ratingIsRankup,
      } : null,
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
    endTime: match.endTime,
    duration: match.duration,
    gameMode: match.gameMode,
    region: match.region,
    winningTeam: match.winningTeam,
    endReason: match.endReason,
    spoilerBlockedUntil: match.spoilerBlockedUntil,
    version: match.version?.name ?? null,
    rosterSynced: match.rosterSynced,
    eventStreamSynced: match.eventStreamSynced,
    dusk,
    dawn,
  };
}
