import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export interface TeamProfile {
  id: string;
  name: string;
  abbreviation: string | null;
  type: string;
  region: string | null;
  notes: string | null;
  createdAt: Date;
  roster: Array<{
    playerId: string;
    displayName: string;
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
        where: { activeTo: null }, // only active members
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
      playerId: r.player.id,
      displayName: r.player.displayName,
      role: r.role,
      activeFrom: r.activeFrom,
      activeTo: r.activeTo,
      lastSynced: r.player.lastSynced,
      rating: snap
        ? { rankLabel: snap.rankLabel, ratingPoints: snap.ratingPoints }
        : null,
    };
  });

  // Aggregate team stats from player snapshots
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalMatches = 0;

  for (const r of team.roster) {
    const snap = r.player.snapshots[0];
    if (!snap) continue;
    const gs = snap.generalStats as Record<string, number>;
    totalKills += gs.kills ?? 0;
    totalDeaths += gs.deaths ?? 0;
    totalAssists += gs.assists ?? 0;
    totalMatches += gs.matches ?? 0;
  }

  const averageKDA = totalDeaths > 0
    ? parseFloat(((totalKills + totalAssists) / totalDeaths).toFixed(2))
    : 0;

  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    type: team.type,
    region: team.region,
    notes: team.notes,
    createdAt: team.createdAt,
    roster,
    aggregateStats: {
      totalMatches,
      averageKDA,
    },
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
          player: {
            select: { id: true, displayName: true },
          },
          role: true,
        },
      },
    },
  });
}
