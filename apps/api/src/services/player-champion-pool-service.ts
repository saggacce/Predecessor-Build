import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export interface ChampionPoolFilters {
  days: number;
  role?: string;
  gameMode?: string;
  heroSlug?: string;
}

interface Aggregate {
  heroSlug: string;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

function add(map: Map<string, Aggregate>, heroSlug: string, won: boolean, kills: number, deaths: number, assists: number): void {
  const current = map.get(heroSlug) ?? { heroSlug, matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
  current.matches += 1;
  current.wins += won ? 1 : 0;
  current.kills += kills;
  current.deaths += deaths;
  current.assists += assists;
  map.set(heroSlug, current);
}

function finish(row: Aggregate) {
  return {
    ...row,
    winRate: Math.round((row.wins / row.matches) * 1000) / 10,
    kda: Math.round(((row.kills + row.assists) / Math.max(row.deaths, 1)) * 100) / 100,
  };
}

export async function getPlayerChampionPoolContext(playerId: string, filters: ChampionPoolFilters) {
  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true, displayName: true, customName: true },
  });
  if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

  const from = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
  const rows = await db.matchPlayer.findMany({
    where: { playerId, match: { startTime: { gte: from } } },
    orderBy: { match: { startTime: 'desc' } },
    include: {
      match: {
        select: {
          gameMode: true,
          winningTeam: true,
          matchPlayers: { select: { id: true, team: true, heroSlug: true, role: true } },
        },
      },
    },
  });

  const available = {
    roles: [...new Set(rows.map((row) => row.role).filter((value): value is string => Boolean(value)))].sort(),
    gameModes: [...new Set(rows.map((row) => row.match.gameMode))].sort(),
    heroes: [...new Set(rows.map((row) => row.heroSlug))].sort(),
  };

  const selected = rows.filter((row) => (
    (!filters.role || row.role === filters.role)
    && (!filters.gameMode || row.match.gameMode === filters.gameMode)
    && (!filters.heroSlug || row.heroSlug === filters.heroSlug)
  ));

  const heroes = new Map<string, Aggregate>();
  const enemies = new Map<string, Aggregate>();
  const allies = new Map<string, Aggregate>();

  for (const row of selected) {
    const won = row.match.winningTeam === row.team;
    add(heroes, row.heroSlug, won, row.kills, row.deaths, row.assists);
    for (const participant of row.match.matchPlayers) {
      if (participant.id === row.id) continue;
      if (participant.team === row.team) add(allies, participant.heroSlug, won, row.kills, row.deaths, row.assists);
      else add(enemies, participant.heroSlug, won, row.kills, row.deaths, row.assists);
    }
  }

  const sortBySample = (a: ReturnType<typeof finish>, b: ReturnType<typeof finish>) => b.matches - a.matches || b.winRate - a.winRate;
  const heroResults = [...heroes.values()].map(finish).sort(sortBySample);
  const matchupResults = [...enemies.values()].map(finish).sort(sortBySample);
  const synergyResults = [...allies.values()].map(finish).sort(sortBySample);
  const reliableMatchups = matchupResults.filter((row) => row.matches >= 2);

  return {
    player,
    period: { days: filters.days, from: from.toISOString(), to: new Date().toISOString() },
    filters: {
      role: filters.role ?? null,
      gameMode: filters.gameMode ?? null,
      heroSlug: filters.heroSlug ?? null,
      available,
    },
    sampleSize: selected.length,
    heroes: heroResults,
    matchups: matchupResults.slice(0, 20),
    synergies: synergyResults.slice(0, 20),
    strongestMatchup: reliableMatchups.length > 0
      ? [...reliableMatchups].sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)[0]
      : null,
    hardestMatchup: reliableMatchups.length > 0
      ? [...reliableMatchups].sort((a, b) => a.winRate - b.winRate || b.matches - a.matches)[0]
      : null,
  };
}
