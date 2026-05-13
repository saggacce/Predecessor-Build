import { Router } from 'express';
import { db } from '../db.js';
import { getAllHeroMeta } from '../services/hero-meta-service.js';

export const heroMetaRouter = Router();

// In-process cache — invalidated by sync
let cache: { data: unknown[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function invalidateHeroMetaCache() {
  cache = null;
}

heroMetaRouter.get('/', async (_req, res, next) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      res.json({ heroes: cache.data });
      return;
    }

    const heroes = await getAllHeroMeta(db);
    cache = { data: heroes, ts: Date.now() };
    res.json({ heroes });
  } catch (err) {
    next(err);
  }
});
