import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export interface TeamProfile {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  type: string;
  region: string | null;
  notes: string | null;
  createdAt: Date;
  roster: Array<{
    rosterId: string;
    playerId: string;
    displayName: string;
    customName: string | null;
    role: string | null;
    activeFrom: Date;
    activeTo: Date | null;
    lastSynced: Date;
    rating: {
      rankLabel: string | null;
      ratingPoints: number | null;
    } | null;
  }>;
  aggregateStats: {
    totalMatches: number;
    averageKDA: number;
  };
}

export async function getTeamProfile(teamId: string): Promise<TeamProfile> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      roster: {
        where: { activeTo: null },
        include: {
          player: {
            include: {
              snapshots: {
                orderBy: { syncedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');
  }

  const roster = team.roster.map((r) => {
    const snap = r.player.snapshots[0] ?? null;
    return {
      rosterId: r.id,
      playerId: r.player.id,
      displayName: r.player.displayName,
      customName: r.player.customName,
      role: r.role,
      activeFrom: r.activeFrom,
      activeTo: r.activeTo,
      lastSynced: r.player.lastSynced,
      rating: snap
        ? { rankLabel: snap.rankLabel, ratingPoints: snap.ratingPoints }
        : null,
    };
  });

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalMatches = 0;

  for (const r of team.roster) {
    const snap = r.player.snapshots[0];
    if (!snap) continue;
    const gs = snap.generalStats;
    if (typeof gs !== 'object' || gs === null || Array.isArray(gs)) continue;
    const stats = gs as Record<string, unknown>;
    totalKills += typeof stats.kills === 'number' ? stats.kills : 0;
    totalDeaths += typeof stats.deaths === 'number' ? stats.deaths : 0;
    totalAssists += typeof stats.assists === 'number' ? stats.assists : 0;
    totalMatches += typeof stats.matches === 'number' ? stats.matches : 0;
  }

  const averageKDA = totalDeaths > 0
    ? Math.round(((totalKills + totalAssists) / totalDeaths) * 100) / 100
    : 0;

  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    logoUrl: team.logoUrl,
    type: team.type,
    region: team.region,
    notes: team.notes,
    createdAt: team.createdAt,
    roster,
    aggregateStats: { totalMatches, averageKDA },
  };
}

export async function listTeams(type?: 'OWN' | 'RIVAL') {
  return db.team.findMany({
    where: type ? { type } : undefined,
    orderBy: { name: 'asc' },
    include: {
      roster: {
        where: { activeTo: null },
        select: {
          player: { select: { id: true, displayName: true, customName: true } },
          role: true,
        },
      },
    },
  });
}

export async function createTeam(data: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  type: 'OWN' | 'RIVAL';
  region?: string;
  notes?: string;
}) {
  const team = await db.team.create({ data });
  return getTeamProfile(team.id);
}

export async function updateTeam(
  teamId: string,
  data: { name?: string; abbreviation?: string | null; logoUrl?: string | null; region?: string | null; notes?: string | null },
) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');
  await db.team.update({ where: { id: teamId }, data });
  return getTeamProfile(teamId);
}

export async function deleteTeam(teamId: string) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');
  // Cascade deletes roster entries via Prisma schema relation
  await db.teamRoster.deleteMany({ where: { teamId } });
  await db.team.delete({ where: { id: teamId } });
}

export async function addRosterPlayer(teamId: string, playerId: string, role?: string) {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) throw new AppError(404, `Player not found: ${playerId}`, 'PLAYER_NOT_FOUND');

  const existing = await db.teamRoster.findFirst({
    where: { teamId, playerId, activeTo: null },
  });
  if (existing) throw new AppError(409, 'Player is already in this roster', 'ALREADY_IN_ROSTER');

  return db.teamRoster.create({ data: { teamId, playerId, role: role ?? null } });
}

export async function updateRosterEntry(teamId: string, rosterId: string, role: string | null) {
  const entry = await db.teamRoster.findUnique({ where: { id: rosterId } });
  if (!entry) throw new AppError(404, `Roster entry not found: ${rosterId}`, 'ROSTER_NOT_FOUND');
  if (entry.teamId !== teamId) throw new AppError(404, `Roster entry not found: ${rosterId}`, 'ROSTER_NOT_FOUND');
  return db.teamRoster.update({ where: { id: rosterId }, data: { role } });
}

export async function removeRosterPlayer(teamId: string, rosterId: string) {
  const entry = await db.teamRoster.findUnique({ where: { id: rosterId } });
  if (!entry) throw new AppError(404, `Roster entry not found: ${rosterId}`, 'ROSTER_NOT_FOUND');
  if (entry.teamId !== teamId) throw new AppError(404, `Roster entry not found: ${rosterId}`, 'ROSTER_NOT_FOUND');
  return db.teamRoster.update({ where: { id: rosterId }, data: { activeTo: new Date() } });
}

// ── Team Analysis ─────────────────────────────────────────────────────────────

export interface PlayerAnalysisStat {
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  rankLabel: string | null;
  ratingPoints: number | null;
  // Multi-match aggregates (from snapshot)
  matches: number;
  winRate: number;
  kda: number;
  // Per-match averages from recent MatchPlayer records
  avgGPM: number | null;
  avgDPM: number | null;
  avgCS: number | null;
  avgWardsPlaced: number | null;
  // Recent form (last 20 matches)
  recentWins: number;
  recentLosses: number;
  // Early death rate (IND-036): deaths in first 10 min / total matches
  earlyDeathRate: number | null;
  // Top heroes from snapshot
  topHeroes: Array<{ slug: string; name: string; matches: number; winRate: number; imageUrl: string | null }>;
}

export interface TeamMatch {
  matchId: string;
  predggUuid: string;
  startTime: Date;
  duration: number;
  gameMode: string;
  teamSide: string;
  won: boolean | null;
  playerCount: number;
  version: string | null;
  firstTowerWon: boolean | null;
}

export interface TeamObjectiveControl {
  entityType: string;
  teamCaptures: number;
  rivalCaptures: number;
  total: number;
  controlPct: number;
  avgGameTimeSecs: number | null;
}

export interface RivalHeroStat {
  playerId: string;
  heroSlug: string;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
}

export interface TeamAnalysis {
  teamId: string;
  teamName: string;
  teamType: string;
  playerStats: PlayerAnalysisStat[];
  teamMatches: TeamMatch[];
  teamWins: number;
  teamLosses: number;
  objectiveControl: TeamObjectiveControl[];
  rivalHeroPool: RivalHeroStat[];
  primeConversionRate: number | null;   // TEAM-016: % of ORB_PRIME that yielded a structure
  fangtoolhConversionRate: number | null; // TEAM-017: % of Fangtooth that yielded a structure
}

function safeNum(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

export async function getTeamAnalysis(teamId: string): Promise<TeamAnalysis> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      roster: {
        where: { activeTo: null },
        include: {
          player: {
            include: { snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 } },
          },
        },
      },
    },
  });

  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const rosterPlayerIds = team.roster.map((r) => r.player.id);
  if (rosterPlayerIds.length === 0) {
    return { teamId, teamName: team.name, teamType: team.type, playerStats: [], teamMatches: [], teamWins: 0, teamLosses: 0, objectiveControl: [] };
  }

  // ── Per-player recent MatchPlayer records ─────────────────────────────────
  const recentMPs = await db.matchPlayer.findMany({
    where: { playerId: { in: rosterPlayerIds } },
    include: { match: { select: { winningTeam: true, duration: true } } },
    orderBy: { match: { startTime: 'desc' } },
    take: 50 * rosterPlayerIds.length,
  });

  // Group by player
  const mpByPlayer = new Map<string, typeof recentMPs>();
  for (const mp of recentMPs) {
    if (!mp.playerId) continue;
    const arr = mpByPlayer.get(mp.playerId) ?? [];
    arr.push(mp);
    mpByPlayer.set(mp.playerId, arr);
  }

  // ── Early death rate per player (IND-036: deaths in first 10 min) ────────
  const earlyDeathRows = rosterPlayerIds.length > 0
    ? await db.$queryRaw<Array<{ killedPlayerId: string; cnt: bigint }>>`
        SELECT hk."killedPlayerId", COUNT(*)::bigint AS cnt
        FROM "HeroKill" hk
        WHERE hk."killedPlayerId" = ANY(${rosterPlayerIds}::text[])
          AND hk."gameTime" < 600
        GROUP BY hk."killedPlayerId"
      `
    : [];
  const earlyDeathMap = new Map(earlyDeathRows.map((r) => [r.killedPlayerId, Number(r.cnt)]));

  // ── Build per-player stats ────────────────────────────────────────────────
  const playerStats: PlayerAnalysisStat[] = team.roster.map((r) => {
    const snap = r.player.snapshots[0] ?? null;
    const gs = (snap?.generalStats ?? {}) as Record<string, unknown>;
    const heroStats = (snap?.heroStats ?? []) as Array<Record<string, unknown>>;

    const mps = mpByPlayer.get(r.player.id) ?? [];
    const recent20 = mps.slice(0, 20);

    // Per-match averages
    const withGold   = mps.filter((m) => m.gold !== null && m.match.duration > 0);
    const withDamage = mps.filter((m) => m.heroDamage !== null && m.match.duration > 0);
    const withCS     = mps.filter((m) => m.laneMinionsKilled !== null);
    const withWards  = mps.filter((m) => m.wardsPlaced !== null);

    const avgGPM = withGold.length > 0 ? Math.round(withGold.reduce((s, m) => s + (m.gold! / (m.match.duration / 60)), 0) / withGold.length) : null;
    const avgDPM = withDamage.length > 0 ? Math.round(withDamage.reduce((s, m) => s + (m.heroDamage! / (m.match.duration / 60)), 0) / withDamage.length) : null;
    const avgCS  = withCS.length > 0 ? Math.round(withCS.reduce((s, m) => s + m.laneMinionsKilled!, 0) / withCS.length) : null;
    const avgW   = withWards.length > 0 ? Math.round(withWards.reduce((s, m) => s + m.wardsPlaced!, 0) / withWards.length * 10) / 10 : null;

    const recentWins   = recent20.filter((m) => m.match.winningTeam && m.team === m.match.winningTeam).length;
    const recentLosses = recent20.filter((m) => m.match.winningTeam && m.team !== m.match.winningTeam).length;

    const topHeroes = heroStats
      .filter((h) => typeof h.matches === 'number' && h.matches > 0)
      .sort((a, b) => safeNum(b.matches) - safeNum(a.matches))
      .slice(0, 5)
      .map((h) => {
        const hd = (h.heroData ?? {}) as Record<string, unknown>;
        return {
          slug: String(hd.slug ?? ''),
          name: String(hd.name ?? hd.slug ?? ''),
          matches: safeNum(h.matches),
          winRate: safeNum(h.winRate),
          imageUrl: typeof hd.imageUrl === 'string' ? hd.imageUrl : null,
        };
      });

    return {
      playerId: r.player.id,
      displayName: r.player.displayName,
      customName: r.player.customName,
      role: r.role,
      rankLabel: snap?.rankLabel ?? null,
      ratingPoints: snap?.ratingPoints ?? null,
      matches: safeNum(gs.matches),
      winRate: safeNum(gs.winRate),
      kda: safeNum(gs.kda),
      avgGPM, avgDPM, avgCS,
      avgWardsPlaced: avgW,
      recentWins, recentLosses,
      earlyDeathRate: safeNum(gs.matches) > 0 ? Math.round((earlyDeathMap.get(r.player.id) ?? 0) / safeNum(gs.matches) * 100) / 100 : null,
      topHeroes,
    };
  });

  // ── Team matches (3+ players on same side) ────────────────────────────────
  const teamMatchRows = await db.$queryRaw<Array<{
    matchId: string; predggUuid: string; startTime: Date; duration: number;
    gameMode: string; team: string; winningTeam: string | null; player_count: bigint; version: string | null;
  }>>`
    SELECT mp."matchId", m."predggUuid", m."startTime", m."duration", m."gameMode",
           mp."team", m."winningTeam", v."name" AS version,
           COUNT(DISTINCT mp."playerId")::bigint AS player_count
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    LEFT JOIN "Version" v ON v.id = m."versionId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
    GROUP BY mp."matchId", m."predggUuid", m."startTime", m."duration",
             m."gameMode", mp."team", m."winningTeam", v."name"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 30
  `;

  // First tower per team match (TEAM-012)
  const rawMatchIds = teamMatchRows.map((r) => r.matchId);
  const firstTowerRows = rawMatchIds.length > 0
    ? await db.structureDestruction.findMany({
        where: { matchId: { in: rawMatchIds }, structureType: 'OUTER_TOWER' },
        select: { matchId: true, gameTime: true, destructionTeam: true },
        orderBy: { gameTime: 'asc' },
      })
    : [];

  const firstTowerByMatch = new Map<string, string | null>();
  for (const sd of firstTowerRows) {
    if (!firstTowerByMatch.has(sd.matchId)) {
      firstTowerByMatch.set(sd.matchId, sd.destructionTeam);
    }
  }

  const teamMatches: TeamMatch[] = teamMatchRows.map((r) => {
    const ft = firstTowerByMatch.get(r.matchId);
    return {
      matchId: r.matchId,
      predggUuid: r.predggUuid,
      startTime: r.startTime,
      duration: r.duration,
      gameMode: r.gameMode,
      teamSide: r.team,
      won: r.winningTeam ? r.team === r.winningTeam : null,
      playerCount: Number(r.player_count),
      version: r.version ?? null,
      firstTowerWon: ft !== undefined && ft !== null ? ft === r.team : null,
    };
  });

  const teamWins   = teamMatches.filter((m) => m.won === true).length;
  const teamLosses = teamMatches.filter((m) => m.won === false).length;

  // ── Objective control: team matches + any individual synced match ─────────
  const teamMatchIds = teamMatches.map((m) => m.matchId);
  const teamSideMap  = new Map(teamMatches.map((m) => [m.matchId, m.teamSide]));

  // Also include individual matches (single player) that have event stream data
  const individualMatchRows = rosterPlayerIds.length > 0
    ? await db.$queryRaw<Array<{ matchId: string; team: string }>>`
        SELECT DISTINCT mp."matchId", mp."team"
        FROM "MatchPlayer" mp
        JOIN "Match" m ON m.id = mp."matchId"
        WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
          AND m."eventStreamSynced" = true
          AND mp."matchId" != ALL(${teamMatchIds.length ? teamMatchIds : ['__none__']}::text[])
        LIMIT 100
      `
    : [];

  for (const r of individualMatchRows) {
    if (!teamSideMap.has(r.matchId)) teamSideMap.set(r.matchId, r.team);
  }
  const allEventMatchIds = [...teamMatchIds, ...individualMatchRows.map((r) => r.matchId)];

  const objKills = allEventMatchIds.length > 0
    ? await db.objectiveKill.findMany({
        where: { matchId: { in: allEventMatchIds } },
        select: { matchId: true, entityType: true, killerTeam: true, gameTime: true },
      })
    : [];

  const objMap = new Map<string, { team: number; rival: number; teamTimes: number[] }>();
  for (const o of objKills) {
    const side = teamSideMap.get(o.matchId);
    if (!side) continue;
    const entry = objMap.get(o.entityType) ?? { team: 0, rival: 0, teamTimes: [] };
    if (o.killerTeam === side) { entry.team++; entry.teamTimes.push(o.gameTime); }
    else entry.rival++;
    objMap.set(o.entityType, entry);
  }

  const objectiveControl: TeamObjectiveControl[] = Array.from(objMap.entries())
    .map(([entityType, { team, rival, teamTimes }]) => {
      const total = team + rival;
      const avgTime = teamTimes.length > 0 ? Math.round(teamTimes.reduce((s, t) => s + t, 0) / teamTimes.length) : null;
      return { entityType, teamCaptures: team, rivalCaptures: rival, total, controlPct: total > 0 ? Math.round((team / total) * 100) : 0, avgGameTimeSecs: avgTime };
    })
    .sort((a, b) => b.total - a.total);

  // ── Hero pool from actual match records (more accurate than snapshot) ────────
  const mpHeroes = await db.$queryRaw<Array<{
    playerId: string; heroSlug: string; games: bigint;
    wins: bigint; totalKda: number;
  }>>`
    SELECT mp."playerId", mp."heroSlug",
           COUNT(*)::bigint AS games,
           COUNT(*) FILTER (WHERE mp.team = m."winningTeam")::bigint AS wins,
           SUM(CASE WHEN mp.deaths > 0 THEN (mp.kills + mp.assists)::float / mp.deaths ELSE mp.kills + mp.assists END) AS "totalKda"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
      AND m."winningTeam" IS NOT NULL
    GROUP BY mp."playerId", mp."heroSlug"
    HAVING COUNT(*) >= 2
    ORDER BY games DESC
  `;

  const rivalHeroPool: RivalHeroStat[] = mpHeroes.map((r) => {
    const games = Number(r.games);
    const wins = Number(r.wins);
    return {
      playerId: r.playerId,
      heroSlug: r.heroSlug,
      games,
      wins,
      winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
      avgKda: games > 0 ? Math.round((r.totalKda / games) * 100) / 100 : 0,
    };
  });

  // ── Conversion rates (TEAM-016/017) ──────────────────────────────────────
  let primeConversionRate: number | null = null;
  let fangtoolhConversionRate: number | null = null;

  const primeKills = objKills.filter((o) => o.entityType === 'ORB_PRIME');
  const ftKills    = objKills.filter((o) => o.entityType === 'FANGTOOTH' || o.entityType === 'PRIMAL_FANGTOOTH');

  if (primeKills.length > 0 || ftKills.length > 0) {
    const convMatchIds = [...new Set([...primeKills, ...ftKills].map((o) => o.matchId))];
    const structDestructions = await db.structureDestruction.findMany({
      where: { matchId: { in: convMatchIds } },
      select: { matchId: true, gameTime: true, destructionTeam: true, structureType: true },
    });
    const sdByMatch = new Map<string, typeof structDestructions>();
    for (const sd of structDestructions) {
      const arr = sdByMatch.get(sd.matchId) ?? [];
      arr.push(sd);
      sdByMatch.set(sd.matchId, arr);
    }

    const primeTaken = primeKills.filter((o) => o.killerTeam === teamSideMap.get(o.matchId));
    const primeConverted = primeTaken.filter((o) => {
      const side = teamSideMap.get(o.matchId);
      return (sdByMatch.get(o.matchId) ?? []).some((sd) =>
        sd.destructionTeam === side &&
        sd.gameTime >= o.gameTime && sd.gameTime <= o.gameTime + 180 &&
        ['INNER_TOWER', 'INHIBITOR', 'CORE'].includes(sd.structureType),
      );
    });
    if (primeTaken.length > 0) primeConversionRate = Math.round((primeConverted.length / primeTaken.length) * 100);

    const ftTaken = ftKills.filter((o) => o.killerTeam === teamSideMap.get(o.matchId));
    const ftConverted = ftTaken.filter((o) => {
      const side = teamSideMap.get(o.matchId);
      return (sdByMatch.get(o.matchId) ?? []).some((sd) =>
        sd.destructionTeam === side &&
        sd.gameTime >= o.gameTime && sd.gameTime <= o.gameTime + 120,
      );
    });
    if (ftTaken.length > 0) fangtoolhConversionRate = Math.round((ftConverted.length / ftTaken.length) * 100);
  }

  return { teamId, teamName: team.name, teamType: team.type, playerStats, teamMatches, teamWins, teamLosses, objectiveControl, rivalHeroPool, primeConversionRate, fangtoolhConversionRate };
}

// ── Phase Analysis ────────────────────────────────────────────────────────────

export interface MatchPhaseStat {
  matchId: string;
  predggUuid: string;
  won: boolean | null;
  killDiff10: number;
  killDiff15: number;
  objectiveDiff10: number;
  objectiveDiff15: number;
  objectiveDiff20: number;
}

export interface TeamPhaseAnalysis {
  sampleSize: number;
  avgKillDiff10: number | null;
  avgKillDiff15: number | null;
  avgObjectiveDiff10: number | null;
  avgObjectiveDiff15: number | null;
  avgObjectiveDiff20: number | null;
  throwRate: number | null;
  comebackRate: number | null;
  perMatch: MatchPhaseStat[];
}

export async function getTeamPhaseAnalysis(teamId: string): Promise<TeamPhaseAnalysis> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const roster = await db.teamRoster.findMany({
    where: { teamId, activeTo: null },
    select: { playerId: true },
  });
  const rosterPlayerIds = roster.map((r) => r.playerId);
  if (rosterPlayerIds.length === 0) return emptyPhaseAnalysis();

  // Team matches with event stream (3+ players same side, eventStreamSynced = true)
  const matchRows = await db.$queryRaw<Array<{
    matchId: string; predggUuid: string; team: string; winningTeam: string | null;
  }>>`
    SELECT mp."matchId", m."predggUuid", mp."team", m."winningTeam"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
      AND m."eventStreamSynced" = true
    GROUP BY mp."matchId", m."predggUuid", m."startTime", mp."team", m."winningTeam"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 50
  `;

  if (matchRows.length === 0) return emptyPhaseAnalysis();

  const matchIds = matchRows.map((r) => r.matchId);
  const sideMap = new Map(matchRows.map((r) => [r.matchId, r.team]));
  const uuidMap = new Map(matchRows.map((r) => [r.matchId, r.predggUuid]));

  // Fetch all HeroKill and ObjectiveKill for these matches in parallel
  const [heroKills, objectiveKills] = await Promise.all([
    db.heroKill.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, killerTeam: true },
    }),
    db.objectiveKill.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, killerTeam: true, entityType: true },
    }),
  ]);

  // Group by matchId
  const killsByMatch = new Map<string, typeof heroKills>();
  for (const k of heroKills) {
    const arr = killsByMatch.get(k.matchId) ?? [];
    arr.push(k);
    killsByMatch.set(k.matchId, arr);
  }

  const objsByMatch = new Map<string, typeof objectiveKills>();
  for (const o of objectiveKills) {
    const arr = objsByMatch.get(o.matchId) ?? [];
    arr.push(o);
    objsByMatch.set(o.matchId, arr);
  }

  const perMatch: MatchPhaseStat[] = matchRows.map((r) => {
    const side = sideMap.get(r.matchId)!;
    const kills = killsByMatch.get(r.matchId) ?? [];
    const objs = objsByMatch.get(r.matchId) ?? [];
    const won = r.winningTeam ? side === r.winningTeam : null;

    const killDiff = (cutoff: number) => {
      const filtered = kills.filter((k) => k.gameTime <= cutoff);
      const team = filtered.filter((k) => k.killerTeam === side).length;
      const rival = filtered.filter((k) => k.killerTeam !== side && k.killerTeam != null).length;
      return team - rival;
    };

    const objDiff = (cutoff: number) => {
      const filtered = objs.filter((o) => o.gameTime <= cutoff);
      const team = filtered.filter((o) => o.killerTeam === side).length;
      const rival = filtered.filter((o) => o.killerTeam !== side && o.killerTeam != null).length;
      return team - rival;
    };

    return {
      matchId: r.matchId,
      predggUuid: uuidMap.get(r.matchId)!,
      won,
      killDiff10: killDiff(600),
      killDiff15: killDiff(900),
      objectiveDiff10: objDiff(600),
      objectiveDiff15: objDiff(900),
      objectiveDiff20: objDiff(1200),
    };
  });

  const n = perMatch.length;
  const avg = (key: keyof MatchPhaseStat) => {
    const vals = perMatch.map((m) => m[key] as number);
    return Math.round((vals.reduce((s, v) => s + v, 0) / n) * 10) / 10;
  };

  // Throw Rate: had kill lead at 10 but lost
  const withOutcome = perMatch.filter((m) => m.won !== null);
  const hadLead10 = withOutcome.filter((m) => m.killDiff10 > 0);
  const throwRate = hadLead10.length > 0
    ? Math.round((hadLead10.filter((m) => !m.won).length / hadLead10.length) * 100)
    : null;

  // Comeback Rate: had kill deficit at 10 but won
  const hadDeficit10 = withOutcome.filter((m) => m.killDiff10 < 0);
  const comebackRate = hadDeficit10.length > 0
    ? Math.round((hadDeficit10.filter((m) => m.won).length / hadDeficit10.length) * 100)
    : null;

  return {
    sampleSize: n,
    avgKillDiff10: n > 0 ? avg('killDiff10') : null,
    avgKillDiff15: n > 0 ? avg('killDiff15') : null,
    avgObjectiveDiff10: n > 0 ? avg('objectiveDiff10') : null,
    avgObjectiveDiff15: n > 0 ? avg('objectiveDiff15') : null,
    avgObjectiveDiff20: n > 0 ? avg('objectiveDiff20') : null,
    throwRate,
    comebackRate,
    perMatch,
  };
}

// ── Vision Analysis ───────────────────────────────────────────────────────────

const MAJOR_OBJECTIVES = ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'];
const VISION_RADIUS = 3000;      // game units around objective
const VISION_WINDOW = 120;       // seconds before objective to look for wards
const ALIVE_WINDOW = 60;         // seconds before objective to check if role was alive
const REACT_WINDOW = 90;         // seconds after death to check for objective reaction

function dist2D(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export interface VisionObjectiveStat {
  entityType: string;
  teamTaken: number;
  avgWardsNearby: number | null;
  avgWardsLost: number | null;
  avgEnemyWardsCleared: number | null;
  junglerAliveRate: number | null;
  supportAliveRate: number | null;
}

export interface TeamVisionAnalysis {
  sampleSize: number;
  visionControlScore: number | null;
  objectiveLostAfterAllyDeathRate: number | null;
  objectiveTakenAfterEnemyDeathRate: number | null;
  byObjective: VisionObjectiveStat[];
}

export async function getTeamVisionAnalysis(teamId: string): Promise<TeamVisionAnalysis> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const roster = await db.teamRoster.findMany({
    where: { teamId, activeTo: null },
    select: { playerId: true },
  });
  const rosterPlayerIds = roster.map((r) => r.playerId);
  if (rosterPlayerIds.length === 0) return emptyVisionAnalysis();

  // Team matches with event stream
  const matchRows = await db.$queryRaw<Array<{
    matchId: string; team: string; winningTeam: string | null;
  }>>`
    SELECT mp."matchId", mp."team", m."winningTeam"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
      AND m."eventStreamSynced" = true
    GROUP BY mp."matchId", m."startTime", mp."team", m."winningTeam"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 50
  `;

  if (matchRows.length === 0) return emptyVisionAnalysis();

  const matchIds = matchRows.map((r) => r.matchId);
  const sideMap = new Map(matchRows.map((r) => [r.matchId, r.team]));

  // Fetch all event stream data for these matches in parallel
  const [wardEvents, heroKills, objectiveKills, matchPlayers] = await Promise.all([
    db.wardEvent.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, eventType: true, team: true, locationX: true, locationY: true },
    }),
    db.heroKill.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, killedTeam: true, killedPlayerId: true },
    }),
    db.objectiveKill.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, entityType: true, killerTeam: true, locationX: true, locationY: true },
    }),
    db.matchPlayer.findMany({
      where: { matchId: { in: matchIds }, playerId: { in: rosterPlayerIds } },
      select: { matchId: true, playerId: true, role: true },
    }),
  ]);

  // Group by matchId
  const wardsByMatch = new Map<string, typeof wardEvents>();
  for (const w of wardEvents) {
    const arr = wardsByMatch.get(w.matchId) ?? [];
    arr.push(w);
    wardsByMatch.set(w.matchId, arr);
  }

  const killsByMatch = new Map<string, typeof heroKills>();
  for (const k of heroKills) {
    const arr = killsByMatch.get(k.matchId) ?? [];
    arr.push(k);
    killsByMatch.set(k.matchId, arr);
  }

  const objsByMatch = new Map<string, typeof objectiveKills>();
  for (const o of objectiveKills) {
    const arr = objsByMatch.get(o.matchId) ?? [];
    arr.push(o);
    objsByMatch.set(o.matchId, arr);
  }

  // Role map: matchId → { JUNGLE: playerId, SUPPORT: playerId }
  const roleMap = new Map<string, Map<string, string>>();
  for (const mp of matchPlayers) {
    if (!mp.playerId || !mp.role) continue;
    const roles = roleMap.get(mp.matchId) ?? new Map<string, string>();
    roles.set(mp.role.toUpperCase(), mp.playerId);
    roleMap.set(mp.matchId, roles);
  }

  // ── Vision Control Score per match ────────────────────────────────────────
  let totalVisionScore = 0;
  for (const r of matchRows) {
    const side = sideMap.get(r.matchId)!;
    const wards = wardsByMatch.get(r.matchId) ?? [];
    const placed  = wards.filter((w) => w.eventType === 'PLACEMENT' && w.team === side).length;
    const enemyCleared = wards.filter((w) => w.eventType === 'DESTRUCTION' && w.team === side).length;
    const ownLost = wards.filter((w) => w.eventType === 'DESTRUCTION' && w.team !== side && w.team != null).length;
    totalVisionScore += placed + enemyCleared - ownLost;
  }
  const visionControlScore = matchRows.length > 0
    ? Math.round((totalVisionScore / matchRows.length) * 10) / 10
    : null;

  // ── By objective stats ────────────────────────────────────────────────────
  const objStats = new Map<string, {
    teamTaken: number;
    wardsNearby: number[]; wardsLost: number[]; enemyCleared: number[];
    junglerAlive: boolean[]; supportAlive: boolean[];
  }>();

  for (const r of matchRows) {
    const side = sideMap.get(r.matchId)!;
    const wards = wardsByMatch.get(r.matchId) ?? [];
    const kills = killsByMatch.get(r.matchId) ?? [];
    const roles = roleMap.get(r.matchId) ?? new Map();
    const objs = (objsByMatch.get(r.matchId) ?? []).filter(
      (o) => MAJOR_OBJECTIVES.includes(o.entityType) && o.killerTeam === side,
    );

    for (const obj of objs) {
      const bucket = objStats.get(obj.entityType) ?? {
        teamTaken: 0, wardsNearby: [], wardsLost: [], enemyCleared: [], junglerAlive: [], supportAlive: [],
      };
      bucket.teamTaken++;

      if (obj.locationX != null && obj.locationY != null) {
        const ox = obj.locationX, oy = obj.locationY;
        const windowStart = obj.gameTime - VISION_WINDOW;

        const nearby = wards.filter((w) =>
          w.eventType === 'PLACEMENT' && w.team === side &&
          w.gameTime >= windowStart && w.gameTime <= obj.gameTime &&
          w.locationX != null && w.locationY != null &&
          dist2D(w.locationX!, w.locationY!, ox, oy) <= VISION_RADIUS,
        ).length;
        bucket.wardsNearby.push(nearby);

        const lost = wards.filter((w) =>
          w.eventType === 'DESTRUCTION' && w.team !== side && w.team != null &&
          w.gameTime >= windowStart && w.gameTime <= obj.gameTime &&
          w.locationX != null && w.locationY != null &&
          dist2D(w.locationX!, w.locationY!, ox, oy) <= VISION_RADIUS,
        ).length;
        bucket.wardsLost.push(lost);

        const cleared = wards.filter((w) =>
          w.eventType === 'DESTRUCTION' && w.team === side &&
          w.gameTime >= windowStart && w.gameTime <= obj.gameTime &&
          w.locationX != null && w.locationY != null &&
          dist2D(w.locationX!, w.locationY!, ox, oy) <= VISION_RADIUS,
        ).length;
        bucket.enemyCleared.push(cleared);
      }

      // Jungler and support alive check
      for (const [roleKey, key] of [['JUNGLE', 'junglerAlive'], ['SUPPORT', 'supportAlive']] as const) {
        const pid = roles.get(roleKey);
        if (pid) {
          const wasDead = kills.some(
            (k) => k.killedPlayerId === pid &&
              k.gameTime >= obj.gameTime - ALIVE_WINDOW && k.gameTime < obj.gameTime,
          );
          (bucket[key] as boolean[]).push(!wasDead);
        }
      }

      objStats.set(obj.entityType, bucket);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
  const rate = (arr: boolean[]) =>
    arr.length > 0 ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : null;

  const byObjective: VisionObjectiveStat[] = Array.from(objStats.entries()).map(([entityType, b]) => ({
    entityType,
    teamTaken: b.teamTaken,
    avgWardsNearby: avg(b.wardsNearby),
    avgWardsLost: avg(b.wardsLost),
    avgEnemyWardsCleared: avg(b.enemyCleared),
    junglerAliveRate: rate(b.junglerAlive),
    supportAliveRate: rate(b.supportAlive),
  }));

  // ── Objective Lost After Ally Death ───────────────────────────────────────
  let allyDeaths = 0, lostAfterDeath = 0;
  for (const r of matchRows) {
    const side = sideMap.get(r.matchId)!;
    const kills = killsByMatch.get(r.matchId) ?? [];
    const objs = objsByMatch.get(r.matchId) ?? [];
    const enemyMajorObjs = objs.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType) && o.killerTeam !== side && o.killerTeam != null);
    const allyKills = kills.filter((k) => k.killedTeam === side);

    for (const death of allyKills) {
      allyDeaths++;
      const triggered = enemyMajorObjs.some(
        (o) => o.gameTime > death.gameTime && o.gameTime <= death.gameTime + REACT_WINDOW,
      );
      if (triggered) lostAfterDeath++;
    }
  }
  const objectiveLostAfterAllyDeathRate = allyDeaths > 0
    ? Math.round((lostAfterDeath / allyDeaths) * 100)
    : null;

  // ── Objective Taken After Enemy Death ─────────────────────────────────────
  let enemyDeaths = 0, takenAfterKill = 0;
  for (const r of matchRows) {
    const side = sideMap.get(r.matchId)!;
    const kills = killsByMatch.get(r.matchId) ?? [];
    const objs = objsByMatch.get(r.matchId) ?? [];
    const ownMajorObjs = objs.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType) && o.killerTeam === side);
    const enemyKills = kills.filter((k) => k.killedTeam !== side && k.killedTeam != null);

    for (const kill of enemyKills) {
      enemyDeaths++;
      const triggered = ownMajorObjs.some(
        (o) => o.gameTime > kill.gameTime && o.gameTime <= kill.gameTime + REACT_WINDOW,
      );
      if (triggered) takenAfterKill++;
    }
  }
  const objectiveTakenAfterEnemyDeathRate = enemyDeaths > 0
    ? Math.round((takenAfterKill / enemyDeaths) * 100)
    : null;

  return {
    sampleSize: matchRows.length,
    visionControlScore,
    objectiveLostAfterAllyDeathRate,
    objectiveTakenAfterEnemyDeathRate,
    byObjective,
  };
}

function emptyVisionAnalysis(): TeamVisionAnalysis {
  return { sampleSize: 0, visionControlScore: null, objectiveLostAfterAllyDeathRate: null, objectiveTakenAfterEnemyDeathRate: null, byObjective: [] };
}

function emptyPhaseAnalysis(): TeamPhaseAnalysis {
  return {
    sampleSize: 0,
    avgKillDiff10: null, avgKillDiff15: null,
    avgObjectiveDiff10: null, avgObjectiveDiff15: null, avgObjectiveDiff20: null,
    throwRate: null, comebackRate: null,
    perMatch: [],
  };
}

// ── Objective Analysis ────────────────────────────────────────────────────────

const CONVERSION_WINDOWS: Record<string, number> = {
  FANGTOOTH: 120, PRIMAL_FANGTOOTH: 120,
  SHAPER: 150,
  ORB_PRIME: 180, MINI_PRIME: 150,
};

const CONVERSION_OBJECTIVES = Object.keys(CONVERSION_WINDOWS);

export interface ObjectiveConversionStat {
  entityType: string;
  taken: number;
  toAnyStructureRate: number | null;
  toInhibitorRate: number | null;
  toCoreRate: number | null;
}

export interface ObjectiveTimingStat {
  entityType: string;
  teamTaken: number;
  avgGameTimeSecs: number | null;
  stdDevSecs: number | null;
  priorityShare: number | null;
}

export interface TeamObjectiveAnalysis {
  sampleSize: number;
  conversions: ObjectiveConversionStat[];
  timingStats: ObjectiveTimingStat[];
}

export async function getTeamObjectiveAnalysis(teamId: string): Promise<TeamObjectiveAnalysis> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const roster = await db.teamRoster.findMany({
    where: { teamId, activeTo: null },
    select: { playerId: true },
  });
  const rosterPlayerIds = roster.map((r) => r.playerId);
  if (rosterPlayerIds.length === 0) return { sampleSize: 0, conversions: [], timingStats: [] };

  const matchRows = await db.$queryRaw<Array<{ matchId: string; team: string }>>`
    SELECT mp."matchId", mp."team"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
      AND m."eventStreamSynced" = true
    GROUP BY mp."matchId", m."startTime", mp."team"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 50
  `;

  if (matchRows.length === 0) return { sampleSize: 0, conversions: [], timingStats: [] };

  const matchIds = matchRows.map((r) => r.matchId);
  const sideMap = new Map(matchRows.map((r) => [r.matchId, r.team]));

  const [objectiveKills, structureDestructions] = await Promise.all([
    db.objectiveKill.findMany({
      where: { matchId: { in: matchIds }, entityType: { in: CONVERSION_OBJECTIVES } },
      select: { matchId: true, gameTime: true, entityType: true, killerTeam: true },
    }),
    db.structureDestruction.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, gameTime: true, structureType: true, destructionTeam: true },
    }),
  ]);

  const sdByMatch = new Map<string, typeof structureDestructions>();
  for (const sd of structureDestructions) {
    const arr = sdByMatch.get(sd.matchId) ?? [];
    arr.push(sd);
    sdByMatch.set(sd.matchId, arr);
  }

  // ── Conversion rates per objective type ───────────────────────────────────
  const convBuckets = new Map<string, { taken: number; toAny: number; toInhibitor: number; toCore: number }>();

  for (const obj of objectiveKills) {
    const side = sideMap.get(obj.matchId);
    if (!side || obj.killerTeam !== side) continue;

    const bucket = convBuckets.get(obj.entityType) ?? { taken: 0, toAny: 0, toInhibitor: 0, toCore: 0 };
    bucket.taken++;

    const window = CONVERSION_WINDOWS[obj.entityType] ?? 120;
    const structs = (sdByMatch.get(obj.matchId) ?? []).filter(
      (sd) => sd.destructionTeam === side && sd.gameTime >= obj.gameTime && sd.gameTime <= obj.gameTime + window,
    );

    if (structs.length > 0) bucket.toAny++;
    if (structs.some((sd) => sd.structureType === 'INHIBITOR')) bucket.toInhibitor++;
    if (structs.some((sd) => sd.structureType === 'CORE')) bucket.toCore++;

    convBuckets.set(obj.entityType, bucket);
  }

  const conversions: ObjectiveConversionStat[] = Array.from(convBuckets.entries()).map(([entityType, b]) => ({
    entityType,
    taken: b.taken,
    toAnyStructureRate: b.taken > 0 ? Math.round((b.toAny / b.taken) * 100) : null,
    toInhibitorRate: b.taken > 0 ? Math.round((b.toInhibitor / b.taken) * 100) : null,
    toCoreRate: b.taken > 0 ? Math.round((b.toCore / b.taken) * 100) : null,
  }));

  // ── Timing consistency (stddev) + priority share ──────────────────────────
  const timingBuckets = new Map<string, number[]>();

  for (const obj of objectiveKills) {
    const side = sideMap.get(obj.matchId);
    if (!side || obj.killerTeam !== side) continue;
    const arr = timingBuckets.get(obj.entityType) ?? [];
    arr.push(obj.gameTime);
    timingBuckets.set(obj.entityType, arr);
  }

  const totalTeamTakes = Array.from(timingBuckets.values()).reduce((s, arr) => s + arr.length, 0);

  const timingStats: ObjectiveTimingStat[] = Array.from(timingBuckets.entries()).map(([entityType, times]) => {
    const n = times.length;
    const avg = n > 0 ? times.reduce((s, t) => s + t, 0) / n : null;
    const stdDev = avg !== null && n > 1
      ? Math.round(Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / n))
      : null;
    return {
      entityType,
      teamTaken: n,
      avgGameTimeSecs: avg !== null ? Math.round(avg) : null,
      stdDevSecs: stdDev,
      priorityShare: totalTeamTakes > 0 ? Math.round((n / totalTeamTakes) * 100) : null,
    };
  }).sort((a, b) => b.teamTaken - a.teamTaken);

  return { sampleSize: matchRows.length, conversions, timingStats };
}

// ── Draft Analysis ────────────────────────────────────────────────────────────

const MIN_HERO_GAMES = 3; // minimum games to count toward hero pool depth

export interface HeroPickStat {
  heroSlug: string;
  pickCount: number;
  pickRate: number;
  wins: number;
  winRate: number;
  playedBy: string[];
}

export interface HeroBanStat {
  heroSlug: string;
  count: number;
  rate: number;
}

export interface PlayerHeroDepth {
  playerId: string;
  heroCount: number;
  topHeroes: Array<{
    heroSlug: string;
    games: number;
    winRate: number;
    comfortScore: number;
  }>;
}

export interface HeroOverlapEntry {
  heroSlug: string;
  playerIds: string[];
}

export interface TeamDraftAnalysis {
  sampleSize: number;
  rankedSampleSize: number;
  pickRates: HeroPickStat[];
  ownBanRates: HeroBanStat[];
  receivedBanRates: HeroBanStat[];
  playerDepth: PlayerHeroDepth[];
  heroOverlap: HeroOverlapEntry[];
}

export async function getTeamDraftAnalysis(teamId: string): Promise<TeamDraftAnalysis> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const roster = await db.teamRoster.findMany({
    where: { teamId, activeTo: null },
    select: { playerId: true },
  });
  const rosterPlayerIds = roster.map((r) => r.playerId);
  if (rosterPlayerIds.length === 0) return emptyDraftAnalysis();

  // Team matches (3+ players same side)
  const matchRows = await db.$queryRaw<Array<{
    matchId: string; team: string; winningTeam: string | null; gameMode: string;
  }>>`
    SELECT mp."matchId", mp."team", m."winningTeam", m."gameMode"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
    GROUP BY mp."matchId", m."startTime", mp."team", m."winningTeam", m."gameMode"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 60
  `;

  if (matchRows.length === 0) return emptyDraftAnalysis();

  const matchIds = matchRows.map((r) => r.matchId);
  const sideMap = new Map(matchRows.map((r) => [r.matchId, r.team]));
  const outcomeMap = new Map(matchRows.map((r) => [r.matchId, r.winningTeam]));
  const rankedMatchIds = matchRows.filter((r) => r.gameMode === 'RANKED').map((r) => r.matchId);

  // All MatchPlayer records for our roster in team matches
  const [teamMPs, heroBans, allMPs] = await Promise.all([
    db.matchPlayer.findMany({
      where: { matchId: { in: matchIds }, playerId: { in: rosterPlayerIds } },
      select: { matchId: true, playerId: true, heroSlug: true, kills: true, deaths: true, assists: true },
    }),
    rankedMatchIds.length > 0
      ? db.heroBan.findMany({
          where: { matchId: { in: rankedMatchIds } },
          select: { matchId: true, heroSlug: true, team: true },
        })
      : Promise.resolve([]),
    // All players' hero stats across all their matches (not just team matches)
    db.matchPlayer.findMany({
      where: { playerId: { in: rosterPlayerIds } },
      select: { playerId: true, heroSlug: true, kills: true, deaths: true, assists: true,
        match: { select: { winningTeam: true } }, team: true },
      orderBy: { match: { startTime: 'desc' } },
      take: 200 * rosterPlayerIds.length,
    }),
  ]);

  // ── Pick rates (team matches) ─────────────────────────────────────────────
  const pickMap = new Map<string, { matchIds: Set<string>; wins: number; playedBy: Set<string> }>();

  for (const mp of teamMPs) {
    const side = sideMap.get(mp.matchId);
    const winner = outcomeMap.get(mp.matchId);
    if (!side || !mp.playerId) continue;

    const entry = pickMap.get(mp.heroSlug) ?? { matchIds: new Set(), wins: 0, playedBy: new Set() };
    entry.matchIds.add(mp.matchId);
    entry.playedBy.add(mp.playerId);
    if (winner && winner === side) entry.wins++;
    pickMap.set(mp.heroSlug, entry);
  }

  const n = matchRows.length;
  const pickRates: HeroPickStat[] = Array.from(pickMap.entries())
    .map(([heroSlug, { matchIds: mids, wins, playedBy }]) => ({
      heroSlug,
      pickCount: mids.size,
      pickRate: Math.round((mids.size / n) * 100),
      wins,
      winRate: mids.size > 0 ? Math.round((wins / mids.size) * 100) : 0,
      playedBy: Array.from(playedBy),
    }))
    .sort((a, b) => b.pickCount - a.pickCount);

  // ── Ban rates (RANKED team matches only) ──────────────────────────────────
  const ownBanMap = new Map<string, number>();
  const recvBanMap = new Map<string, number>();

  for (const ban of heroBans) {
    const side = sideMap.get(ban.matchId);
    if (!side) continue;
    if (ban.team === side) {
      ownBanMap.set(ban.heroSlug, (ownBanMap.get(ban.heroSlug) ?? 0) + 1);
    } else {
      recvBanMap.set(ban.heroSlug, (recvBanMap.get(ban.heroSlug) ?? 0) + 1);
    }
  }

  const rn = rankedMatchIds.length;
  const toBanStats = (map: Map<string, number>): HeroBanStat[] =>
    Array.from(map.entries())
      .map(([heroSlug, count]) => ({ heroSlug, count, rate: rn > 0 ? Math.round((count / rn) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

  // ── Hero pool depth + comfort score (all matches, per player) ─────────────
  const heroMapByPlayer = new Map<string, Map<string, { games: number; wins: number; kda: number }>>();

  for (const mp of allMPs) {
    if (!mp.playerId) continue;
    const won = mp.match.winningTeam && mp.team === mp.match.winningTeam;
    const kda = mp.deaths > 0 ? (mp.kills + mp.assists) / mp.deaths : mp.kills + mp.assists;

    const playerMap = heroMapByPlayer.get(mp.playerId) ?? new Map();
    const hero = playerMap.get(mp.heroSlug) ?? { games: 0, wins: 0, kda: 0 };
    hero.games++;
    if (won) hero.wins++;
    hero.kda = (hero.kda * (hero.games - 1) + kda) / hero.games;
    playerMap.set(mp.heroSlug, hero);
    heroMapByPlayer.set(mp.playerId, playerMap);
  }

  const playerDepth: PlayerHeroDepth[] = rosterPlayerIds.map((pid) => {
    const heroMap = heroMapByPlayer.get(pid) ?? new Map();
    const qualified = Array.from(heroMap.entries()).filter(([, h]) => h.games >= MIN_HERO_GAMES);
    const topHeroes = qualified
      .map(([heroSlug, h]) => {
        const wr = Math.round((h.wins / h.games) * 100);
        const kda = Math.round(h.kda * 100) / 100;
        // Comfort score: WR weighted by log(games), scaled by KDA
        const comfortScore = Math.round(((wr / 100) * Math.log(h.games + 1) * kda) * 10) / 10;
        return { heroSlug, games: h.games, winRate: wr, comfortScore };
      })
      .sort((a, b) => b.comfortScore - a.comfortScore)
      .slice(0, 10);

    return { playerId: pid, heroCount: qualified.length, topHeroes };
  });

  // ── Hero overlap (heroes played by 2+ roster players with ≥MIN_HERO_GAMES) ─
  const heroToPlayers = new Map<string, string[]>();
  for (const pd of playerDepth) {
    for (const h of pd.topHeroes) {
      const arr = heroToPlayers.get(h.heroSlug) ?? [];
      arr.push(pd.playerId);
      heroToPlayers.set(h.heroSlug, arr);
    }
  }

  const heroOverlap: HeroOverlapEntry[] = Array.from(heroToPlayers.entries())
    .filter(([, players]) => players.length >= 2)
    .map(([heroSlug, playerIds]) => ({ heroSlug, playerIds }))
    .sort((a, b) => b.playerIds.length - a.playerIds.length);

  return {
    sampleSize: n,
    rankedSampleSize: rn,
    pickRates,
    ownBanRates: toBanStats(ownBanMap),
    receivedBanRates: toBanStats(recvBanMap),
    playerDepth,
    heroOverlap,
  };
}

function emptyDraftAnalysis(): TeamDraftAnalysis {
  return { sampleSize: 0, rankedSampleSize: 0, pickRates: [], ownBanRates: [], receivedBanRates: [], playerDepth: [], heroOverlap: [] };
}

// ── Rival Scouting ────────────────────────────────────────────────────────────

export interface ThreatPlayer {
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  threatScore: number;
  games: number;
  winRate: number;
  kda: number;
  avgDPM: number | null;
  topHeroes: Array<{ heroSlug: string; games: number; winRate: number }>;
}

export interface RivalScoutingReport {
  teamId: string;
  teamName: string;
  sampleSize: number;
  recentForm: { wins: number; losses: number; last10: string[]; trend: 'improving' | 'declining' | 'stable' };
  identity: string[];
  strongPhase: 'early' | 'mid' | 'late' | null;
  weakPhase: 'early' | 'mid' | 'late' | null;
  throwRate: number | null;
  threatPlayers: ThreatPlayer[];
  weakRole: string | null;
  objectivePriority: Array<{ entityType: string; controlPct: number; avgGameTimeSecs: number | null }>;
}

export async function getTeamRivalScouting(teamId: string): Promise<RivalScoutingReport> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const roster = await db.teamRoster.findMany({
    where: { teamId, activeTo: null },
    select: { playerId: true, role: true },
  });
  const rosterPlayerIds = roster.map((r) => r.playerId);
  const roleByPlayer = new Map(roster.map((r) => [r.playerId, r.role]));

  if (rosterPlayerIds.length === 0) return emptyRivalScouting(teamId, team.name);

  const matchRows = await db.$queryRaw<Array<{
    matchId: string; team: string; winningTeam: string | null; startTime: Date; duration: number;
  }>>`
    SELECT mp."matchId", mp."team", m."winningTeam", m."startTime", m."duration"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
    GROUP BY mp."matchId", mp."team", m."winningTeam", m."startTime", m."duration"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 50
  `;

  const n = matchRows.length;
  if (n === 0) return emptyRivalScouting(teamId, team.name);

  const matchIds = matchRows.map((r) => r.matchId);
  const sideMap = new Map(matchRows.map((r) => [r.matchId, r.team]));

  // Recent form
  const last10 = matchRows.slice(0, 10).map((r) =>
    r.winningTeam ? (r.team === r.winningTeam ? 'W' : 'L') : 'U'
  );
  const wins = last10.filter((r) => r === 'W').length;
  const losses = last10.filter((r) => r === 'L').length;
  const firstHalf = last10.slice(0, 5).filter((r) => r === 'W').length;
  const secondHalf = last10.slice(5).filter((r) => r === 'W').length;
  // firstHalf = most recent 5 matches, secondHalf = older 5
  // More wins in recent half → improving; more wins in older half → declining
  const trend: 'improving' | 'declining' | 'stable' =
    firstHalf > secondHalf + 1 ? 'improving' : secondHalf > firstHalf + 1 ? 'declining' : 'stable';

  // Per-player stats
  const playerMPs = await db.matchPlayer.findMany({
    where: { matchId: { in: matchIds }, playerId: { in: rosterPlayerIds } },
    select: {
      playerId: true, heroSlug: true, kills: true, deaths: true, assists: true,
      heroDamage: true, team: true,
      match: { select: { winningTeam: true, duration: true } },
    },
  });

  const playerStats = new Map<string, {
    games: number; wins: number; totalKda: number; totalDpm: number; dpmCount: number;
    heroes: Map<string, { games: number; wins: number }>;
  }>();

  for (const mp of playerMPs) {
    if (!mp.playerId) continue;
    const won = mp.match.winningTeam && mp.team === mp.match.winningTeam;
    const kda = mp.deaths > 0 ? (mp.kills + mp.assists) / mp.deaths : mp.kills + mp.assists;
    const dpm = mp.heroDamage !== null ? mp.heroDamage / Math.max(mp.match.duration / 60, 1) : null;
    const stat = playerStats.get(mp.playerId) ?? { games: 0, wins: 0, totalKda: 0, totalDpm: 0, dpmCount: 0, heroes: new Map() };
    stat.games++;
    if (won) stat.wins++;
    stat.totalKda += kda;
    if (dpm !== null) { stat.totalDpm += dpm; stat.dpmCount++; }
    const heroStat = stat.heroes.get(mp.heroSlug) ?? { games: 0, wins: 0 };
    heroStat.games++;
    if (won) heroStat.wins++;
    stat.heroes.set(mp.heroSlug, heroStat);
    playerStats.set(mp.playerId, stat);
  }

  const players = await db.player.findMany({
    where: { id: { in: rosterPlayerIds } },
    select: { id: true, displayName: true, customName: true },
  });
  const playerNameMap = new Map(players.map((p) => [p.id, p]));

  const threatPlayers: ThreatPlayer[] = rosterPlayerIds
    .filter((pid) => playerStats.has(pid))
    .map((pid) => {
      const stat = playerStats.get(pid)!;
      const wr = stat.games > 0 ? Math.round((stat.wins / stat.games) * 100) : 0;
      const kda = Math.round((stat.totalKda / stat.games) * 100) / 100;
      const avgDPM = stat.dpmCount > 0 ? Math.round(stat.totalDpm / stat.dpmCount) : null;
      const threatScore = Math.round(((wr / 100) * kda * Math.log(stat.games + 1)) * 10) / 10;
      const p = playerNameMap.get(pid);
      const topHeroes = Array.from(stat.heroes.entries())
        .filter(([, h]) => h.games >= 2)
        .map(([heroSlug, h]) => ({ heroSlug, games: h.games, winRate: Math.round((h.wins / h.games) * 100) }))
        .sort((a, b) => b.games - a.games)
        .slice(0, 5);
      return { playerId: pid, displayName: p?.displayName ?? 'Unknown', customName: p?.customName ?? null, role: roleByPlayer.get(pid) ?? null, threatScore, games: stat.games, winRate: wr, kda, avgDPM, topHeroes };
    })
    .sort((a, b) => b.threatScore - a.threatScore);

  const rolesWithStats = threatPlayers.filter((p) => p.role);
  const weakRole = rolesWithStats.length > 0
    ? rolesWithStats.reduce((min, p) => p.threatScore < min.threatScore ? p : min).role
    : null;

  // Objective priority
  const objKills = await db.objectiveKill.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, entityType: true, killerTeam: true, gameTime: true },
  });
  const objMap = new Map<string, { team: number; rival: number; teamTimes: number[] }>();
  for (const o of objKills) {
    const side = sideMap.get(o.matchId);
    if (!side) continue;
    const entry = objMap.get(o.entityType) ?? { team: 0, rival: 0, teamTimes: [] };
    if (o.killerTeam === side) { entry.team++; entry.teamTimes.push(o.gameTime); }
    else entry.rival++;
    objMap.set(o.entityType, entry);
  }
  const objectivePriority = Array.from(objMap.entries())
    .map(([entityType, { team, rival, teamTimes }]) => {
      const total = team + rival;
      const avgTime = teamTimes.length > 0 ? Math.round(teamTimes.reduce((s, t) => s + t, 0) / teamTimes.length) : null;
      return { entityType, controlPct: total > 0 ? Math.round((team / total) * 100) : 0, avgGameTimeSecs: avgTime };
    })
    .sort((a, b) => b.controlPct - a.controlPct);

  // Phase and identity
  const heroKills = await db.heroKill.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, gameTime: true, killerTeam: true },
  });
  const killDiff10s = matchRows.map((r) => {
    const side = sideMap.get(r.matchId)!;
    const kills = heroKills.filter((k) => k.matchId === r.matchId && k.gameTime <= 600);
    return kills.filter((k) => k.killerTeam === side).length - kills.filter((k) => k.killerTeam !== side && k.killerTeam != null).length;
  });
  const avgKillDiff10 = killDiff10s.length > 0 ? killDiff10s.reduce((s, v) => s + v, 0) / killDiff10s.length : 0;

  const allMatches = matchRows.filter((r) => r.winningTeam);
  const avgWinDur = allMatches.filter((r) => r.team === r.winningTeam).map((r) => r.duration).reduce((s, v, _, a) => s + v / a.length, 0);
  const avgLossDur = allMatches.filter((r) => r.team !== r.winningTeam).map((r) => r.duration).reduce((s, v, _, a) => s + v / a.length, 0);
  const overallWR = n > 0 ? Math.round((matchRows.filter((r) => r.winningTeam && r.team === r.winningTeam).length / n) * 100) : 0;

  const hadLeadLost = killDiff10s.filter((d, i) => d > 0 && matchRows[i].winningTeam && matchRows[i].team !== matchRows[i].winningTeam).length;
  const hadLead = killDiff10s.filter((d) => d > 0).length;
  const throwRate = hadLead > 0 ? Math.round((hadLeadLost / hadLead) * 100) : null;

  const fangPct = objectivePriority.find((o) => ['FANGTOOTH', 'PRIMAL_FANGTOOTH'].includes(o.entityType))?.controlPct ?? 0;
  const primePct = objectivePriority.find((o) => ['ORB_PRIME', 'MINI_PRIME'].includes(o.entityType))?.controlPct ?? 0;

  const identity: string[] = [];
  if (avgKillDiff10 > 1.5) identity.push('Early Aggressor');
  if (fangPct > 58 || primePct > 58) identity.push('Objective Focused');
  if (avgWinDur > avgLossDur + 180 && overallWR > 45) identity.push('Late Game Scaling');
  if ((throwRate ?? 0) > 30) identity.push('Throw-prone');
  if (avgKillDiff10 < -1) identity.push('Passive Farmer');
  if (identity.length === 0) identity.push('Balanced');

  const strongPhase = avgKillDiff10 > 1 ? 'early' : overallWR > 55 && avgWinDur > 1800 ? 'late' : null;
  const weakPhase = avgKillDiff10 < -1 ? 'early' : overallWR < 45 && avgLossDur < avgWinDur ? 'late' : null;

  return { teamId, teamName: team.name, sampleSize: n, recentForm: { wins, losses, last10, trend }, identity, strongPhase, weakPhase, throwRate, threatPlayers, weakRole, objectivePriority };
}

function emptyRivalScouting(teamId: string, teamName: string): RivalScoutingReport {
  return { teamId, teamName, sampleSize: 0, recentForm: { wins: 0, losses: 0, last10: [], trend: 'stable' }, identity: [], strongPhase: null, weakPhase: null, throwRate: null, threatPlayers: [], weakRole: null, objectivePriority: [] };
}
