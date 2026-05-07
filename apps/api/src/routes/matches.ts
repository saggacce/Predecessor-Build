import { Router } from 'express';
import { getMatchDetail, getMatchEvents } from '../services/match-service.js';
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
 * GET /matches/:id/events
 * Returns all stored event stream data for a match (kills, objectives, structures, wards, transactions).
 */
matchesRouter.get('/:id/events', async (req, res, next) => {
  try {
    const events = await getMatchEvents(req.params.id);
    res.json(events);
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
    // Force full re-sync when user explicitly requests it
    await resyncMatch(db, match.predggUuid, userToken ?? undefined, true);
    // Also force event stream re-sync to get goldEarnedAtInterval and latest events
    if (userToken) {
      await (await import('../services/sync-service.js')).syncMatchEventStream(
        db, match.id, match.predggUuid, userToken, true
      );
    }
    const detail = await getMatchDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});
