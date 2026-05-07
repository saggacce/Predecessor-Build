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
}

export interface TeamObjectiveControl {
  entityType: string;
  teamCaptures: number;
  rivalCaptures: number;
  total: number;
  controlPct: number;
}

export interface TeamAnalysis {
  teamId: string;
  teamName: string;
  teamType: string;
  playerStats: PlayerAnalysisStat[];
  teamMatches: TeamMatch[];       // matches with 3+ players together
  teamWins: number;
  teamLosses: number;
  objectiveControl: TeamObjectiveControl[];
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
      topHeroes,
    };
  });

  // ── Team matches (3+ players on same side) ────────────────────────────────
  const teamMatchRows = await db.$queryRaw<Array<{
    matchId: string; predggUuid: string; startTime: Date; duration: number;
    gameMode: string; team: string; winningTeam: string | null; player_count: bigint;
  }>>`
    SELECT mp."matchId", m."predggUuid", m."startTime", m."duration", m."gameMode",
           mp."team", m."winningTeam", COUNT(DISTINCT mp."playerId")::bigint AS player_count
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
    GROUP BY mp."matchId", m."predggUuid", m."startTime", m."duration",
             m."gameMode", mp."team", m."winningTeam"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 30
  `;

  const teamMatches: TeamMatch[] = teamMatchRows.map((r) => ({
    matchId: r.matchId,
    predggUuid: r.predggUuid,
    startTime: r.startTime,
    duration: r.duration,
    gameMode: r.gameMode,
    teamSide: r.team,
    won: r.winningTeam ? r.team === r.winningTeam : null,
    playerCount: Number(r.player_count),
  }));

  const teamWins   = teamMatches.filter((m) => m.won === true).length;
  const teamLosses = teamMatches.filter((m) => m.won === false).length;

  // ── Objective control from team matches with event stream ─────────────────
  const teamMatchIds = teamMatches.map((m) => m.matchId);
  const teamSideMap  = new Map(teamMatches.map((m) => [m.matchId, m.teamSide]));

  const objKills = teamMatchIds.length > 0
    ? await db.objectiveKill.findMany({
        where: { matchId: { in: teamMatchIds } },
        select: { matchId: true, entityType: true, killerTeam: true },
      })
    : [];

  const objMap = new Map<string, { team: number; rival: number }>();
  for (const o of objKills) {
    const side = teamSideMap.get(o.matchId);
    if (!side) continue;
    const entry = objMap.get(o.entityType) ?? { team: 0, rival: 0 };
    if (o.killerTeam === side) entry.team++;
    else entry.rival++;
    objMap.set(o.entityType, entry);
  }

  const objectiveControl: TeamObjectiveControl[] = Array.from(objMap.entries())
    .map(([entityType, { team, rival }]) => {
      const total = team + rival;
      return { entityType, teamCaptures: team, rivalCaptures: rival, total, controlPct: total > 0 ? Math.round((team / total) * 100) : 0 };
    })
    .sort((a, b) => b.total - a.total);

  return { teamId, teamName: team.name, teamType: team.type, playerStats, teamMatches, teamWins, teamLosses, objectiveControl };
}
