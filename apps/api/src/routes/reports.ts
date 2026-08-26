import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateScrimReport } from '../services/report-service.js';
import { generatePlayerWeeklyReport } from '../services/player-weekly-report-service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { db } from '../db.js';

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

/**
 * GET /reports/player-weekly/:playerId
 * Personal seven-day report compared with the trailing 30-day baseline.
 * A normal account can only request its own linked player; platform admins can
 * preview any player report for support and QA.
 */
reportsRouter.get('/player-weekly/:playerId', requireAuth, async (req, res, next) => {
  try {
    const playerId = z.string().min(1).parse(req.params.playerId);
    const user = req.user!;
    const isPlatformAdmin = user.globalRole === 'PLATFORM_ADMIN' || user.globalRole === 'SUPER_ADMIN';

    if (!isPlatformAdmin) {
      const account = await db.user.findUnique({
        where: { id: user.userId },
        select: { linkedPlayerId: true },
      });
      const membershipPlayerIds = user.memberships.map((membership) => membership.playerId).filter(Boolean);
      const ownsPlayer = account?.linkedPlayerId === playerId || membershipPlayerIds.includes(playerId);
      if (!ownsPlayer) {
        res.status(403).json({ error: { message: 'You can only view your own weekly report', code: 'FORBIDDEN' } });
        return;
      }
    }

    res.json(await generatePlayerWeeklyReport(playerId));
  } catch (err) {
    next(err);
  }
});
