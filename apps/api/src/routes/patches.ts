import { Router } from 'express';
import { db } from '../db.js';

export const patchesRouter = Router();

/**
 * GET /patches/latest
 * Returns the most recent game version/patch.
 */
patchesRouter.get('/latest', async (_req, res, next) => {
  try {
    const latest = await db.version.findFirst({
      orderBy: { releaseDate: 'desc' },
    });

    if (!latest) {
      res.status(404).json({ error: { message: 'No patches synced yet', code: 'NO_PATCHES' } });
      return;
    }

    res.json({
      id: latest.id,
      predggId: latest.predggId,
      name: latest.name,
      releaseDate: latest.releaseDate,
      patchType: latest.patchType,
      syncedAt: latest.syncedAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /patches
 * Returns all synced patches ordered by release date (newest first).
 */
patchesRouter.get('/', async (_req, res, next) => {
  try {
    const patches = await db.version.findMany({
      orderBy: { releaseDate: 'desc' },
    });
    res.json({ patches });
  } catch (err) {
    next(err);
  }
});
