import type { OmedaHero } from '@predecessor/data-model';
import type { StatBlock } from './types.js';

/**
 * Resolves a hero's base stats at a given level.
 *
 * omeda.city returns each stat as an array: 18 entries for level-scaling stats,
 * 1 entry for level-invariant constants (attack_range, base_movement_speed, etc.).
 */
export function calculateStats(hero: OmedaHero, level: number): StatBlock {
  if (level < 1 || level > 18) {
    throw new RangeError(`level must be 1–18, got ${level}`);
  }

  const result: StatBlock = {};

  for (const [key, values] of Object.entries(hero.base_stats)) {
    result[key] = values.length === 1 ? values[0] : values[level - 1];
  }

  return result;
}

/**
 * Adds item stats on top of a hero's base StatBlock.
 * All item bonuses stack additively (Predecessor has no diminishing returns at this layer).
 */
export function applyItems(base: StatBlock, items: { stats: StatBlock }[]): StatBlock {
  const result: StatBlock = { ...base };

  for (const item of items) {
    for (const [key, value] of Object.entries(item.stats)) {
      result[key] = (result[key] ?? 0) + value;
    }
  }

  return result;
}
