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
  customName: string | null;
  isPrivate: boolean;
  isConsole: boolean;
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
    matchUuid: string;
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
    gameMode: string;
    heroName: string | null;
    heroImageUrl: string | null;
    wardsPlaced: number | null;
    wardsDestroyed: number | null;
    level: number | null;
    laneMinionsKilled: number | null;
    totalDamageDealtToStructures: number | null;
    totalDamageDealtToObjectives: number | null;
    totalHealingDone: number | null;
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
      matchUuid: mp.match.predggUuid,
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
      wardsPlaced: mp.wardsPlaced,
      wardsDestroyed: mp.wardsDestroyed,
      level: mp.level,
      laneMinionsKilled: mp.laneMinionsKilled,
      totalDamageDealtToStructures: mp.totalDamageDealtToStructures,
      totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives,
      totalHealingDone: mp.totalHealingDone,
    };
  });

  return {
    id: player.id,
    displayName: player.displayName,
    customName: player.customName,
    isPrivate: player.isPrivate,
    isConsole: player.isConsole,
    inferredRegion: player.inferredRegion,
    firstSeen: player.firstSeen,
    lastSynced: player.lastSynced,
    rating: latestSnapshot
      ? {
          rankLabel: latestSnapshot.rankLabel,
          ratingPoints: latestSnapshot.ratingPoints,
        }
      : null,
    generalStats: (() => {
      // Use snapshot generalStats if it has numeric match data
      const sg = isRecord(latestSnapshot?.generalStats) ? latestSnapshot.generalStats : {};
      if (typeof (sg as Record<string, unknown>).matches === 'number') return sg;

      // Fallback: calculate from MatchPlayer records already loaded
      if (player.matchPlayers.length === 0) return sg;
      const mps = player.matchPlayers;
      const wins = mps.filter(mp => mp.match.winningTeam !== null && mp.team === mp.match.winningTeam).length;
      const totalKills = mps.reduce((s, mp) => s + mp.kills, 0);
      const totalDeaths = mps.reduce((s, mp) => s + mp.deaths, 0);
      const totalAssists = mps.reduce((s, mp) => s + mp.assists, 0);
      const totalDmg = mps.reduce((s, mp) => s + (mp.heroDamage ?? 0), 0);
      return {
        ...sg,
        matches: mps.length,
        wins,
        losses: mps.length - wins,
        winRate: mps.length > 0 ? Math.round((wins / mps.length) * 1000) / 10 : 0,
        kda: totalDeaths > 0 ? Math.round(((totalKills + totalAssists) / totalDeaths) * 100) / 100 : totalKills + totalAssists,
        heroDamage: totalDmg,
      };
    })(),
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
      OR: [
        { displayName: { contains: query, mode: 'insensitive' } },
        { customName: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { lastSynced: 'desc' },
    take: limit,
    select: {
      id: true,
      displayName: true,
      customName: true,
      isPrivate: true,
      isConsole: true,
      inferredRegion: true,
      lastSynced: true,
    },
  });
}

// ── Advanced per-player metrics ───────────────────────────────────────────────

export interface PlayerAdvancedMetrics {
  sampleSize: number;
  eventStreamSampleSize: number;
  goldSharePct: number | null;
  damageSharePct: number | null;
  killSharePct: number | null;
  efficiencyGap: number | null;
  earlyDeathRate: number | null;
  firstDeathRate: number | null;
}

export async function getPlayerAdvancedMetrics(playerId: string): Promise<PlayerAdvancedMetrics> {
  const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true } });
  if (!player) throw new AppError(404, `Player not found: ${playerId}`, 'PLAYER_NOT_FOUND');

  // All MatchPlayer records for this player (last 100)
  const myMPs = await db.matchPlayer.findMany({
    where: { playerId },
    select: {
      matchId: true, team: true, kills: true, gold: true, heroDamage: true, assists: true,
      match: { select: { winningTeam: true, eventStreamSynced: true, duration: true } },
    },
    orderBy: { match: { startTime: 'desc' } },
    take: 100,
  });

  if (myMPs.length === 0) return empty();

  const matchIds = myMPs.map((m) => m.matchId);

  // All team-mates in those matches (for share calculations)
  const teamMPs = await db.matchPlayer.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, team: true, kills: true, gold: true, heroDamage: true },
  });

  // Group team-mates by matchId
  const teamByMatch = new Map<string, typeof teamMPs>();
  for (const mp of teamMPs) {
    const arr = teamByMatch.get(mp.matchId) ?? [];
    arr.push(mp);
    teamByMatch.set(mp.matchId, arr);
  }

  // HeroKill events for matches with event stream
  const eventMatchIds = myMPs.filter((m) => m.match.eventStreamSynced).map((m) => m.matchId);

  const heroKills = eventMatchIds.length > 0
    ? await db.heroKill.findMany({
        where: { matchId: { in: eventMatchIds } },
        select: { matchId: true, gameTime: true, killedPlayerId: true, killedTeam: true },
      })
    : [];

  const killsByMatch = new Map<string, typeof heroKills>();
  for (const k of heroKills) {
    const arr = killsByMatch.get(k.matchId) ?? [];
    arr.push(k);
    killsByMatch.set(k.matchId, arr);
  }

  // ── Share metrics (all matches with gold/damage data) ─────────────────────
  const goldShares: number[] = [];
  const dmgShares: number[] = [];
  const killShares: number[] = [];

  for (const mp of myMPs) {
    const teammates = (teamByMatch.get(mp.matchId) ?? []).filter((t) => t.team === mp.team);
    const teamGold = teammates.reduce((s, t) => s + (t.gold ?? 0), 0);
    const teamDmg  = teammates.reduce((s, t) => s + (t.heroDamage ?? 0), 0);
    const teamKills = teammates.reduce((s, t) => s + t.kills, 0);

    if (mp.gold != null && teamGold > 0) goldShares.push((mp.gold / teamGold) * 100);
    if (mp.heroDamage != null && teamDmg > 0) dmgShares.push((mp.heroDamage / teamDmg) * 100);
    if (teamKills > 0) killShares.push((mp.kills / teamKills) * 100);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

  const goldSharePct = avg(goldShares);
  const damageSharePct = avg(dmgShares);
  const killSharePct = avg(killShares);
  const efficiencyGap = damageSharePct !== null && goldSharePct !== null
    ? Math.round((damageSharePct - goldSharePct) * 10) / 10
    : null;

  // ── Early death rate (deaths in first 10 min / total matches) ────────────
  const earlyDeaths = heroKills.filter(
    (k) => k.killedPlayerId === playerId && k.gameTime < 600,
  ).length;
  const earlyDeathRate = eventMatchIds.length > 0
    ? Math.round((earlyDeaths / eventMatchIds.length) * 100) / 100
    : null;

  // ── First death rate (was player first death of their team in match) ──────
  let firstDeathCount = 0;
  for (const mp of myMPs.filter((m) => m.match.eventStreamSynced)) {
    const kills = (killsByMatch.get(mp.matchId) ?? [])
      .filter((k) => k.killedTeam === mp.team)
      .sort((a, b) => a.gameTime - b.gameTime);
    if (kills.length > 0 && kills[0].killedPlayerId === playerId) firstDeathCount++;
  }
  const firstDeathRate = eventMatchIds.length > 0
    ? Math.round((firstDeathCount / eventMatchIds.length) * 100) / 100
    : null;

  return {
    sampleSize: myMPs.length,
    eventStreamSampleSize: eventMatchIds.length,
    goldSharePct,
    damageSharePct,
    killSharePct,
    efficiencyGap,
    earlyDeathRate,
    firstDeathRate,
  };
}

function empty(): PlayerAdvancedMetrics {
  return {
    sampleSize: 0, eventStreamSampleSize: 0,
    goldSharePct: null, damageSharePct: null, killSharePct: null,
    efficiencyGap: null, earlyDeathRate: null, firstDeathRate: null,
  };
}
