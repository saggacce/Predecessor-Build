import { Router } from 'express';
import { getTeamInsights } from '../services/analyst-service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export const analystRouter = Router();

analystRouter.get('/insights/:teamId', requireAuth, requireRole(['COACH', 'ANALISTA', 'MANAGER']), async (req, res, next) => {
  try {
    const insights = await getTeamInsights(req.params.teamId);
    res.json({ insights });
  } catch (err) {
    next(err);
  }
});
