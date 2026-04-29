import { Router } from 'express';
import { z } from 'zod';
import { generateScrimReport } from '../services/report-service.js';

export const reportsRouter = Router();

/**
 * POST /reports/scrim
 * Body: { ownTeamId: string, rivalTeamId: string }
 * Generate a pre-scrim intelligence report.
 */
reportsRouter.post('/scrim', async (req, res, next) => {
  try {
    const body = z.object({
      ownTeamId: z.string().min(1),
      rivalTeamId: z.string().min(1),
    }).parse(req.body);

    const report = await generateScrimReport(body.ownTeamId, body.rivalTeamId);
    res.json(report);
  } catch (err) {
    next(err);
  }
});
