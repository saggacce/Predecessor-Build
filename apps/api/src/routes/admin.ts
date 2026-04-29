import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const adminRouter = Router();

/**
 * POST /admin/sync-data
 * Body: { command: 'sync-all' | 'sync-versions' | 'sync-player' | 'sync-stale', args?: string[] }
 */
adminRouter.post('/sync-data', async (req, res, next) => {
  try {
    const body = z.object({
      command: z.enum(['sync-all', 'sync-versions', 'sync-player', 'sync-stale']),
      args: z.array(z.string()).optional(),
    }).parse(req.body);

    const argsStr = body.args ? ` ${body.args.join(' ')}` : '';
    // Call the worker CLI via npm script. Assumes running from monorepo context.
    const syncDir = path.resolve(process.cwd(), '../../workers/data-sync');
    const { stdout, stderr } = await execAsync(`npx tsx src/index.ts ${body.command}${argsStr}`, { cwd: syncDir });

    res.json({ 
      command: body.command, 
      stdout: stdout.trim(), 
      stderr: stderr.trim(), 
      timestamp: new Date() 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/sync-logs
 * Returns the most recent sync log entries.
 */
adminRouter.get('/sync-logs', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const logs = await db.syncLog.findMany({
      orderBy: { syncedAt: 'desc' },
      take: limit,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});
