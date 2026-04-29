import { Router } from 'express';
import { z } from 'zod';
import { getPlayerProfile, comparePlayers, searchPlayers } from '../services/player-service.js';
import { AppError } from '../middleware/error-handler.js';

export const playersRouter = Router();

/**
 * GET /players/search?q=name&limit=20
 * Search players by display name.
 */
playersRouter.get('/search', async (req, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const results = await searchPlayers(q, limit);
    res.json({ results });
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
 * POST /players/compare
 * Body: { playerIdA: string, playerIdB: string }
 * Compare two players side by side.
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
