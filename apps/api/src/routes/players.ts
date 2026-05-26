import { Router } from 'express';
import { z } from 'zod';
import { getPlayerProfile, comparePlayers, searchPlayers, getPlayerAdvancedMetrics } from '../services/player-service.js';
import { syncPlayerByName, syncRecentMatchesForPlayer } from '../services/sync-service.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/require-auth.js';
import { db } from '../db.js';
import { getValidToken, exchangeToken } from './auth.js';

export const playersRouter = Router();

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;

async function predggPlayerQuery<T>(query: string, variables: Record<string, unknown>, userToken?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
  else if (API_KEY) headers['X-Api-Key'] = API_KEY;
  const res = await fetch(GQL_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new AppError(502, `pred.gg ${res.status}`, 'PREDGG_ERROR');
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new AppError(502, json.errors.map((e) => e.message).join(', '), 'PREDGG_ERROR');
  return json.data as T;
}

const SCOUT_QUERY = `
  query PlayerScout($uuid: ID!) {
    player(by: { id: $uuid }) {
      id
      uuid
      name
      favRole
      firstPlayedAt
      lastPlayedAt
      ratings {
        points
        percentile
        peakPoints
        peakPercentile
        rank { name tierName }
        peakRank { name tierName }
        rating { name }
      }
      generalStatistic(filter: {}) {
        result {
          matchesPlayed matchesWon
          totalKills totalDeaths totalAssists
          totalHeroDamage totalWardsPlaced totalWardsDestroyed totalMinionsKilled
          objectiveDamage structureDamage totalTime
          doubleKills tripleKills quadraKills pentaKills
        }
      }
      heroStatistics(filter: {}) {
        results {
          hero {
            slug
            data { displayName icon promoIcon defaultSkin { smallPortrait portrait icon } }
          }
          matchesPlayed matchesWon
          totalKills totalDeaths totalAssists
          totalHeroDamage totalGold
        }
      }
      roleStatistics(filter: {}) {
        results {
          role matchesPlayed matchesWon
          totalKills totalDeaths totalAssists
        }
      }
      matchesPaginated(limit: 10) {
        results {
          id role team
          kills deaths assists gold heroDamage wardsPlaced
          hero {
            slug
            data { displayName defaultSkin { smallPortrait portrait icon } promoIcon icon }
          }
          match {
            id startTime duration gameMode winningTeam
            version { name }
          }
        }
      }
    }
  }
`;

function safeN(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0; }
function pct(wins: number, matches: number): number {
  return matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0;
}
function kda(k: number, d: number, a: number): number {
  return d === 0 ? k + a : Math.round(((k + a) / d) * 100) / 100;
}
function pickHeroImg(data?: { displayName?: string; icon?: string; promoIcon?: string; defaultSkin?: { icon?: string; portrait?: string; smallPortrait?: string } | null } | null): string | null {
  if (!data) return null;
  return data.defaultSkin?.smallPortrait ?? data.defaultSkin?.portrait ?? data.defaultSkin?.icon ?? data.promoIcon ?? data.icon ?? null;
}

function buildScoutingProfile(raw: unknown) {
  const p = (raw as { player?: Record<string, unknown> | null }).player;
  if (!p) throw new AppError(404, 'Player not found on pred.gg', 'PLAYER_NOT_FOUND');

  // Rating
  const ratings = (p.ratings as Array<Record<string, unknown>> | null) ?? [];
  const currentRating = ratings.find((r) => typeof r.points === 'number') ?? ratings[0] ?? null;
  const currentRank = (currentRating?.rank as { name?: string; tierName?: string } | null) ?? null;

  // General stats
  const gen = ((p.generalStatistic as { result?: Record<string, unknown> | null } | null)?.result) ?? {};
  const matches = safeN(gen.matchesPlayed);
  const wins = safeN(gen.matchesWon);
  const losses = Math.max(matches - wins, 0);
  const totalTime = safeN(gen.totalTime); // seconds
  const kills = safeN(gen.totalKills);
  const deaths = safeN(gen.totalDeaths);
  const assists = safeN(gen.totalAssists);

  // Hero pool
  const heroResults = ((p.heroStatistics as { results?: unknown[] } | null)?.results ?? []) as Array<Record<string, unknown>>;
  const heroPool = heroResults
    .filter((h) => safeN(h.matchesPlayed) > 0)
    .map((h) => {
      const hm = safeN(h.matchesPlayed);
      const hw = safeN(h.matchesWon);
      const hk = safeN(h.totalKills);
      const hd = safeN(h.totalDeaths);
      const ha = safeN(h.totalAssists);
      const hero = h.hero as { slug?: string; data?: { displayName?: string; icon?: string; promoIcon?: string; defaultSkin?: { smallPortrait?: string; portrait?: string; icon?: string } } } | null;
      return {
        heroSlug: hero?.slug ?? 'unknown',
        heroName: hero?.data?.displayName ?? hero?.slug ?? 'Unknown',
        heroImageUrl: pickHeroImg(hero?.data),
        matches: hm,
        wins: hw,
        winRate: pct(hw, hm),
        kda: kda(hk, hd, ha),
        heroDamagePerMatch: hm > 0 ? Math.round(safeN(h.totalHeroDamage) / hm) : 0,
      };
    })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 12);

  // Role distribution
  const roleResults = ((p.roleStatistics as { results?: unknown[] } | null)?.results ?? []) as Array<Record<string, unknown>>;
  const roleDistribution = roleResults
    .filter((r) => safeN(r.matchesPlayed) > 0)
    .map((r) => {
      const rm = safeN(r.matchesPlayed);
      const rw = safeN(r.matchesWon);
      return {
        role: String(r.role ?? 'UNKNOWN'),
        matches: rm,
        winRate: pct(rw, rm),
        kda: kda(safeN(r.totalKills), safeN(r.totalDeaths), safeN(r.totalAssists)),
      };
    })
    .sort((a, b) => b.matches - a.matches);

  // Recent form
  const matchResults = ((p.matchesPaginated as { results?: unknown[] } | null)?.results ?? []) as Array<Record<string, unknown>>;
  const recentForm = matchResults.map((mp) => {
    const match = mp.match as { id?: string; startTime?: string; duration?: number; gameMode?: string; winningTeam?: string; version?: { name?: string } } | null;
    const hero = mp.hero as { slug?: string; data?: { displayName?: string; defaultSkin?: { smallPortrait?: string; portrait?: string; icon?: string }; promoIcon?: string; icon?: string } } | null;
    const isWin = mp.team === match?.winningTeam;
    return {
      predggMatchId: match?.id ?? '',
      date: match?.startTime ?? '',
      heroSlug: hero?.slug ?? 'unknown',
      heroName: hero?.data?.displayName ?? hero?.slug ?? null,
      heroImageUrl: pickHeroImg(hero?.data),
      result: (isWin ? 'win' : 'loss') as 'win' | 'loss',
      kills: safeN(mp.kills),
      deaths: safeN(mp.deaths),
      assists: safeN(mp.assists),
      gold: typeof mp.gold === 'number' ? mp.gold : null,
      heroDamage: typeof mp.heroDamage === 'number' ? mp.heroDamage : null,
      wardsPlaced: typeof mp.wardsPlaced === 'number' ? mp.wardsPlaced : null,
      gameMode: match?.gameMode ?? 'UNKNOWN',
      duration: match?.duration ?? 0,
      patch: match?.version?.name ?? null,
      role: typeof mp.role === 'string' ? mp.role : null,
    };
  });

  return {
    predggUuid: String(p.uuid ?? p.id ?? ''),
    name: String(p.name ?? ''),
    favRole: typeof p.favRole === 'string' ? p.favRole : null,
    firstPlayedAt: typeof p.firstPlayedAt === 'string' ? p.firstPlayedAt : null,
    lastPlayedAt: typeof p.lastPlayedAt === 'string' ? p.lastPlayedAt : null,
    rating: {
      current: currentRank ? {
        points: safeN(currentRating?.points),
        rankName: currentRank.name ?? '',
        tierName: currentRank.tierName ?? '',
        percentile: typeof currentRating?.percentile === 'number' ? currentRating.percentile : null,
      } : null,
      peak: (() => {
        const pk = ratings.find((r) => typeof r.peakPoints === 'number') ?? currentRating;
        const pkRank = (pk?.peakRank as { name?: string; tierName?: string } | null) ?? currentRank;
        return pkRank ? { points: safeN(pk?.peakPoints ?? pk?.points), rankName: pkRank.name ?? '', tierName: pkRank.tierName ?? '' } : null;
      })(),
    },
    generalStats: {
      matches, wins, losses,
      winRate: pct(wins, matches),
      kills, deaths, assists,
      kda: kda(kills, deaths, assists),
      heroDamagePerMatch: matches > 0 ? Math.round(safeN(gen.totalHeroDamage) / matches) : 0,
      wardsPlacedPerMatch: matches > 0 ? Math.round((safeN(gen.totalWardsPlaced) / matches) * 10) / 10 : 0,
      wardsDestroyedPerMatch: matches > 0 ? Math.round((safeN(gen.totalWardsDestroyed) / matches) * 10) / 10 : 0,
      csPerMatch: matches > 0 ? Math.round(safeN(gen.totalMinionsKilled) / matches) : 0,
      objectiveDamagePerMatch: matches > 0 ? Math.round(safeN(gen.objectiveDamage) / matches) : 0,
      avgGameMinutes: totalTime > 0 && matches > 0 ? Math.round(totalTime / matches / 60 * 10) / 10 : null,
      multiKills: {
        double: safeN(gen.doubleKills),
        triple: safeN(gen.tripleKills),
        quadra: safeN(gen.quadraKills),
        penta: safeN(gen.pentaKills),
      },
    },
    heroPool,
    roleDistribution,
    recentForm,
  };
}

const SEASONS_QUERY = `
  query PlayerSeasons($uuid: ID!) {
    player(by: { id: $uuid }) {
      favRegion
      ratings {
        rank { name tierName icon }
        points
        rating { name group }
      }
    }
  }
`;

/**
 * GET /players/:id/seasons
 * Fetches season ratings directly from pred.gg using player's predggUuid.
 */
playersRouter.get('/:id/seasons', requireAuth, async (req, res, next) => {
  try {
    const player = await db.player.findUnique({ where: { id: req.params.id }, select: { predggUuid: true } });
    if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-Api-Key'] = API_KEY;

    const r = await fetch(GQL_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ query: SEASONS_QUERY, variables: { uuid: player.predggUuid } }),
    });
    const json = (await r.json()) as { data?: { player: { favRegion: string; ratings: Array<{ rank: { name: string; tierName: string; icon: string }; points: number; rating: { name: string; group: string } }> } | null } };

    const data = json.data?.player;
    res.json({ favRegion: data?.favRegion ?? null, ratings: data?.ratings ?? [] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /players/search?q=name&limit=20
 * Searches the local database for players matching the name.
 */
playersRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q, limit } = z.object({
      q: z.string().min(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);
    const results = await searchPlayers(q, limit);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /players/:id/scout
 * Recruiting scorecard fetched live from pred.gg — no DB write.
 * Returns aggregated stats, hero pool, role distribution and recent form.
 */
playersRouter.get('/:id/scout', requireAuth, async (req, res, next) => {
  try {
    const player = await db.player.findUnique({
      where: { id: req.params.id },
      select: { predggUuid: true },
    });
    if (!player?.predggUuid) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

    const userToken = await getValidToken(req, res);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
    else if (API_KEY) headers['X-Api-Key'] = API_KEY;

    const r = await fetch(GQL_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ query: SCOUT_QUERY, variables: { uuid: player.predggUuid } }),
    });
    if (!r.ok) throw new AppError(502, `pred.gg ${r.status}`, 'PREDGG_ERROR');
    const json = (await r.json()) as { data?: unknown; errors?: { message: string }[] };
    if (json.errors?.length) throw new AppError(502, json.errors.map((e) => e.message).join(', '), 'PREDGG_ERROR');

    res.json(buildScoutingProfile(json.data));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /players/sync
 * Body: { name: string }
 * Fetches a player from pred.gg and saves them to the local database.
 * Returns the synced player record immediately — no child process, no CLI.
 * Match history is only synced for players that belong to a team.
 */
playersRouter.post('/sync', async (req, res, next) => {
  try {
    const { name } = z.object({
      name: z.string().min(1).max(100).trim(),
    }).parse(req.body);

    // Try user OAuth token first, fall back to stored platform credentials
    let userToken = await getValidToken(req, res);
    if (!userToken) {
      try {
        const cred = await db.platformCredential.findUnique({ where: { key: 'predgg_refresh_token' } });
        if (cred) {
          const result = await exchangeToken({ grant_type: 'refresh_token', refresh_token: cred.value });
          if (result.ok && result.data.access_token) userToken = result.data.access_token;
        }
      } catch { /* no stored token, continue without */ }
    }
    const synced = await syncPlayerByName(db, name, userToken);

    if (!synced) {
      throw new AppError(
        404,
        `Player "${name}" not found on pred.gg`,
        'PLAYER_NOT_FOUND_PREDGG',
      );
    }

    // Only sync match history for players that are members of a team.
    // Standalone scouted players get live data on demand via /players/:id/scout.
    if (userToken && synced.predggId) {
      const hasTeam = await db.teamMembership.count({
        where: { playerId: synced.id },
      });
      if (hasTeam > 0) {
        syncRecentMatchesForPlayer(db, synced.predggId, userToken, 10).catch(() => null);
      }
    }

    res.json({ synced: true, player: synced });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /players/:id
 * Get full player profile with latest stats and recent matches.
 */
playersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const profile = await getPlayerProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /players/:id/name
 * Body: { customName: string | null }
 * Sets a custom display name for a player. Never overwritten by sync.
 */
playersRouter.patch('/:id/name', async (req, res, next) => {
  try {
    const { customName } = z.object({
      customName: z.string().min(1).max(50).nullable(),
    }).parse(req.body);

    const player = await db.player.findUnique({ where: { id: req.params.id } });
    if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

    const updated = await db.player.update({
      where: { id: req.params.id },
      data: { customName },
      select: { id: true, customName: true, displayName: true },
    });

    res.json({ player: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /players/compare
 * Body: { playerIdA: string, playerIdB: string }
 */
playersRouter.get('/:id/advanced-metrics', async (req, res, next) => {
  try {
    const data = await getPlayerAdvancedMetrics(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

playersRouter.post('/compare', async (req, res, next) => {
  try {
    const body = z.object({
      playerIdA: z.string().min(1),
      playerIdB: z.string().min(1),
    }).parse(req.body);
    const comparison = await comparePlayers(body.playerIdA, body.playerIdB);
    res.json(comparison);
  } catch (err) {
    next(err);
  }
});
