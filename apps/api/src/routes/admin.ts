import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { db } from '../db.js';
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);

export const adminRouter = Router();

// Simple API key guard — set ADMIN_API_KEY in .env to enable protection.
// Without it the endpoint is open (acceptable for local dev MVP).
function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next(); // no key configured → allow in dev
  const provided = req.headers['x-admin-key'];
  if (provided !== key) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'ADMIN_KEY_REQUIRED' } });
    return;
  }
  next();
}

adminRouter.use(requireAdminKey);

const SYNC_COMMANDS = ['sync-all', 'sync-versions', 'sync-player', 'sync-stale', 'sync-match', 'sync-player-matches'] as const;
type SyncCommand = typeof SYNC_COMMANDS[number];

const syncBodySchema = z.object({
  command: z.enum(SYNC_COMMANDS),
  // Each arg validated individually: no shell metacharacters allowed
  args: z.array(z.string().regex(/^[a-zA-Z0-9_\-. ]+$/, 'Invalid argument')).max(5).optional(),
});

/**
 * POST /admin/sync-data
 * Body: { command: SyncCommand, args?: string[] }
 * Protected by X-Admin-Key header when ADMIN_API_KEY env var is set.
 */
adminRouter.post('/sync-data', async (req, res, next) => {
  try {
    const body = syncBodySchema.parse(req.body);
    const syncDir = path.resolve(process.cwd(), '../../workers/data-sync');

    // Use execFile (not exec) to prevent shell injection — args are passed as
    // an array, never interpolated into a shell string.
    const cmdArgs = ['tsx', 'src/index.ts', body.command, ...(body.args ?? [])];
    const start = Date.now();
    logger.info({ command: body.command, args: body.args }, 'sync started');

    let stdout = '';
    let stderr = '';
    try {
      ({ stdout, stderr } = await execFileAsync('npx', cmdArgs, { cwd: syncDir }));
      const elapsed = Date.now() - start;
      logger.info({ command: body.command, elapsed }, 'sync completed');
    } catch (syncErr) {
      const elapsed = Date.now() - start;
      logger.error({ command: body.command, elapsed, err: syncErr }, 'sync failed');
      throw syncErr;
    }

    res.json({
      command: body.command,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      timestamp: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

const logsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50),
});

/**
 * GET /admin/sync-logs?limit=50
 */
adminRouter.get('/sync-logs', async (req, res, next) => {
  try {
    const { limit } = logsQuerySchema.parse(req.query);
    const logs = await db.syncLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: limit,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export type { SyncCommand };
