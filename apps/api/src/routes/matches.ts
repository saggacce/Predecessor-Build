import { Router } from 'express';
import { getMatchDetail } from '../services/match-service.js';
import { resyncMatch } from '../services/sync-service.js';
import { getValidToken } from './auth.js';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export const matchesRouter = Router();

/**
 * GET /matches/:id
 * Full match detail: both teams, per-player stats, hero meta.
 */
matchesRouter.get('/:id', async (req, res, next) => {
  try {
    const detail = await getMatchDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /matches/:id/sync
 * Re-fetches this match from pred.gg using the user's Bearer token.
 * Reveals player names that appear as HIDDEN without auth.
 */
matchesRouter.post('/:id/sync', async (req, res, next) => {
  try {
    const match = await db.match.findUnique({ where: { id: req.params.id } });
    if (!match) throw new AppError(404, 'Match not found', 'MATCH_NOT_FOUND');
    const userToken = await getValidToken(req, res);
    await resyncMatch(db, match.predggUuid, userToken ?? undefined);
    const detail = await getMatchDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});
