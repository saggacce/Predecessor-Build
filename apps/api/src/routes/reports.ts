import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateScrimReport } from '../services/report-service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export const reportsRouter = Router();

function attachOwnTeamId(req: Request, _res: Response, next: NextFunction): void {
  if (req.body?.ownTeamId && !req.body.teamId) {
    req.body = { ...req.body, teamId: req.body.ownTeamId };
  }
  next();
}

/**
 * POST /reports/scrim
 * Body: { ownTeamId: string, rivalTeamId: string }
 * Generate a pre-scrim intelligence report.
 */
reportsRouter.post('/scrim', requireAuth, attachOwnTeamId, requireRole(['COACH', 'ANALISTA', 'MANAGER']), async (req, res, next) => {
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
