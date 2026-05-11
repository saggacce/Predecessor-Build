import { Router } from 'express';
import { db } from '../db.js';
import { ZONE_DEFINITIONS } from '@predecessor/domain-engine';
import { logger } from '../logger.js';

export const mapZonesRouter = Router();

mapZonesRouter.get('/', async (_req, res, next) => {
  try {
    const zones = await db.mapZone.findMany({ orderBy: { zoneType: 'asc' } });
    res.json({ zones });
  } catch (err) {
    next(err);
  }
});

// Seed all zones from ZONE_DEFINITIONS — idempotent (upserts by key)
mapZonesRouter.post('/seed', async (_req, res, next) => {
  try {
    let created = 0;
    let updated = 0;
    for (const zone of ZONE_DEFINITIONS) {
      const existing = await db.mapZone.findUnique({ where: { key: zone.key } });
      if (existing) {
        await db.mapZone.update({
          where: { key: zone.key },
          data: { name: zone.name, polygon: zone.polygon, zoneType: zone.zoneType, relatedObjective: zone.relatedObjective },
        });
        updated++;
      } else {
        await db.mapZone.create({
          data: { key: zone.key, name: zone.name, polygon: zone.polygon, zoneType: zone.zoneType, relatedObjective: zone.relatedObjective },
        });
        created++;
      }
    }
    logger.info({ created, updated }, 'map zones seeded');
    res.json({ ok: true, created, updated, total: ZONE_DEFINITIONS.length });
  } catch (err) {
    next(err);
  }
});
