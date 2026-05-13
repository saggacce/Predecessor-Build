import { type PrismaClient } from '@prisma/client';

export interface ConfigEntry {
  key: string;
  value: number;
  defaultValue: number;
  minValue: number | null;
  maxValue: number | null;
  label: string;
  description: string;
  group: string;
  unit: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

// In-process cache — invalidated on write
let cache: { map: Map<string, number>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateConfigCache() {
  cache = null;
}

export async function getConfigMap(db: PrismaClient): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.map;
  const rows = await db.platformConfig.findMany({ select: { key: true, value: true } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  cache = { map, ts: Date.now() };
  return map;
}

export async function getAllConfig(db: PrismaClient): Promise<ConfigEntry[]> {
  const rows = await db.platformConfig.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  return rows as ConfigEntry[];
}

export async function updateConfigValue(
  db: PrismaClient,
  key: string,
  value: number,
  userId: string,
): Promise<ConfigEntry> {
  const existing = await db.platformConfig.findUnique({ where: { key } });
  if (!existing) throw new Error(`Config key not found: ${key}`);

  if (existing.minValue !== null && value < existing.minValue)
    throw new Error(`Value ${value} is below minimum ${existing.minValue}`);
  if (existing.maxValue !== null && value > existing.maxValue)
    throw new Error(`Value ${value} exceeds maximum ${existing.maxValue}`);

  const updated = await db.platformConfig.update({
    where: { key },
    data: { value, updatedBy: userId },
  });
  invalidateConfigCache();
  return updated as ConfigEntry;
}

export async function resetConfigValue(db: PrismaClient, key: string, userId: string): Promise<ConfigEntry> {
  const existing = await db.platformConfig.findUnique({ where: { key } });
  if (!existing) throw new Error(`Config key not found: ${key}`);
  const updated = await db.platformConfig.update({
    where: { key },
    data: { value: existing.defaultValue, updatedBy: userId },
  });
  invalidateConfigCache();
  return updated as ConfigEntry;
}
