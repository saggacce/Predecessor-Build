import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { syncVersionsFromPredgg, syncStalePlayers } from '../services/sync-service.js';
import { getValidToken } from './auth.js';

export const adminRouter = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next();
  if (req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'ADMIN_KEY_REQUIRED' } });
    return;
  }
  next();
}

adminRouter.use(requireAdminKey);

/**
 * POST /admin/sync-versions
 * Fetches all game versions from pred.gg and upserts into local DB.
 */
adminRouter.post('/sync-versions', async (_req, res, next) => {
  try {
    const start = Date.now();
    logger.info('admin: sync-versions started');
    const count = await syncVersionsFromPredgg(db);
    const elapsed = Date.now() - start;
    logger.info({ count, elapsed }, 'admin: sync-versions complete');
    res.json({ synced: count, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/sync-stale
 * Re-syncs all players whose data is older than 1 hour.
 */
adminRouter.post('/sync-stale', async (req, res, next) => {
  try {
    const start = Date.now();
    const userToken = await getValidToken(req, res);
    if (!userToken) {
      logger.warn('sync-stale called without user token — player queries will fail (login required)');
    }
    logger.info({ hasToken: !!userToken }, 'admin: sync-stale started');
    const result = await syncStalePlayers(db, userToken);
    const elapsed = Date.now() - start;
    logger.info({ ...result, elapsed }, 'admin: sync-stale complete');
    res.json({ ...result, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

const logsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50),
  entity: z.string().optional(),
  status: z.enum(['ok', 'error', 'skipped']).optional(),
});

/**
 * GET /admin/sync-logs?limit=50&entity=player&status=error
 */
adminRouter.get('/sync-logs', async (req, res, next) => {
  try {
    const { limit, entity, status } = logsQuerySchema.parse(req.query);
    const logs = await db.syncLog.findMany({
      where: {
        ...(entity && { entity }),
        ...(status && { status }),
      },
      orderBy: { syncedAt: 'desc' },
      take: limit,
    });
    res.json({ logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});
