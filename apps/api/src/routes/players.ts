import { Router } from 'express';
import { z } from 'zod';
import { getPlayerProfile, comparePlayers, searchPlayers } from '../services/player-service.js';
import { syncPlayerByName } from '../services/sync-service.js';
import { AppError } from '../middleware/error-handler.js';
import { db } from '../db.js';
import { getValidToken } from './auth.js';

export const playersRouter = Router();

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
