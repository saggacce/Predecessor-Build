import { Router } from 'express';
import { getMatchDetail } from '../services/match-service.js';

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
