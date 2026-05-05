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
