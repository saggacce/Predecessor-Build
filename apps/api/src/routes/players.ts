import { Router } from 'express';
import { z } from 'zod';
import { getPlayerProfile, comparePlayers, searchPlayers } from '../services/player-service.js';
import { syncPlayerByName } from '../services/sync-service.js';
import { AppError } from '../middleware/error-handler.js';
import { db } from '../db.js';
import { getValidToken } from './auth.js';

export const playersRouter = Router();

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;

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
playersRouter.get('/:id/seasons', async (req, res, next) => {
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
playersRouter.get('/search', async (req, res, next) => {
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
 * POST /players/sync
 * Body: { name: string }
 * Fetches a player from pred.gg and saves them to the local database.
 * Returns the synced player record immediately — no child process, no CLI.
 */
playersRouter.post('/sync', async (req, res, next) => {
  try {
    const { name } = z.object({
      name: z.string().min(1).max(100).trim(),
    }).parse(req.body);

    const userToken = await getValidToken(req, res);
    const synced = await syncPlayerByName(db, name, userToken);

    if (!synced) {
      throw new AppError(
        404,
        `Player "${name}" not found on pred.gg`,
        'PLAYER_NOT_FOUND_PREDGG',
      );
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
playersRouter.get('/:id', async (req, res, next) => {
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
