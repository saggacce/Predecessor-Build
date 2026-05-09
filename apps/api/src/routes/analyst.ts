import { Router } from 'express';
import { getTeamInsights } from '../services/analyst-service.js';

export const analystRouter = Router();

analystRouter.get('/insights/:teamId', async (req, res, next) => {
  try {
    const insights = await getTeamInsights(req.params.teamId);
    res.json({ insights });
  } catch (err) {
    next(err);
  }
});
