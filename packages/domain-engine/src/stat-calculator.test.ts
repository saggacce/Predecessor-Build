import { describe, it, expect } from 'vitest';
import type { OmedaHero } from '@predecessor/data-model';
import { calculateStats, applyItems } from './stat-calculator.js';

// Minimal fixture representing a Fighter/Offlane hero.
// Stat arrays follow the omeda.city contract: 18 entries = per-level, 1 entry = constant.
const mockFighter: OmedaHero = {
  id: 1,
  name: 'TestFighter',
  display_name: 'Test Fighter',
  slug: 'test-fighter',
  image: '/assets/test.webp',
  stats: [6, 4, 3, 2],
  classes: ['Fighter'],
  roles: ['Offlane'],
  abilities: [],
  base_stats: {
    // 18-entry arrays: index 0 = level 1, index 17 = level 18
    max_health: [
      600, 680, 764, 852, 944, 1040, 1140, 1244, 1352, 1464,
      1580, 1700, 1824, 1952, 2084, 2220, 2360, 2504,
    ],
    physical_power: [
      55, 57.5, 60.1, 62.8, 65.6, 68.5, 71.5, 74.6, 77.8, 81.1,
      84.5, 88.0, 91.6, 95.3, 99.1, 103.0, 107.0, 111.1,
    ],
    physical_armor: [
      28, 31, 34.2, 37.6, 41.2, 45.0, 49.0, 53.2, 57.6, 62.2,
      67.0, 72.0, 77.2, 82.6, 88.2, 94.0, 100.0, 106.2,
    ],
    // 1-entry arrays: level-invariant constants
    attack_range: [200],
    base_movement_speed: [680],
  },
};

// Fixture representing a mage with a single-role and mana stats.
const mockMage: OmedaHero = {
  id: 2,
  name: 'TestMage',
  display_name: 'Test Mage',
  slug: 'test-mage',
  image: '/assets/test-mage.webp',
  stats: [2, 3, 8, 5],
  classes: ['Mage'],
  roles: ['Midlane'],
  abilities: [],
  base_stats: {
    max_health: [
      480, 542, 608, 678, 752, 830, 912, 998, 1088, 1182,
      1280, 1382, 1488, 1598, 1712, 1830, 1952, 2078,
    ],
    max_mana: [
      320, 362, 407, 455, 506, 560, 617, 677, 740, 806,
      875, 947, 1022, 1100, 1181, 1265, 1352, 1442,
    ],
    attack_range: [600],
    base_movement_speed: [650],
  },
};

describe('calculateStats', () => {
  describe('level-scaling stats', () => {
    it('returns index 0 values at level 1', () => {
      const s = calculateStats(mockFighter, 1);
      expect(s.max_health).toBe(600);
      expect(s.physical_power).toBe(55);
      expect(s.physical_armor).toBe(28);
    });

    it('returns index 17 values at level 18', () => {
      const s = calculateStats(mockFighter, 18);
      expect(s.max_health).toBe(2504);
      expect(s.physical_power).toBeCloseTo(111.1);
      expect(s.physical_armor).toBeCloseTo(106.2);
    });

    it('returns mid-game values at level 9', () => {
      const s = calculateStats(mockFighter, 9);
      expect(s.max_health).toBe(1352);
      expect(s.physical_armor).toBeCloseTo(57.6);
    });
  });

  describe('level-invariant constants', () => {
    it('returns the same attack_range at every level', () => {
      expect(calculateStats(mockFighter, 1).attack_range).toBe(200);
      expect(calculateStats(mockFighter, 9).attack_range).toBe(200);
      expect(calculateStats(mockFighter, 18).attack_range).toBe(200);
    });

    it('returns the same base_movement_speed at every level', () => {
      expect(calculateStats(mockFighter, 1).base_movement_speed).toBe(680);
      expect(calculateStats(mockFighter, 18).base_movement_speed).toBe(680);
    });
  });

  describe('multi-role hero', () => {
    it('works regardless of how many roles the hero has', () => {
      const multiRole: OmedaHero = {
        ...mockFighter,
        roles: ['Offlane', 'Jungle'],
      };
      expect(calculateStats(multiRole, 1).max_health).toBe(600);
    });
  });

  describe('mage-specific stats', () => {
    it('includes max_mana for heroes that have it', () => {
      expect(calculateStats(mockMage, 1).max_mana).toBe(320);
      expect(calculateStats(mockMage, 18).max_mana).toBe(1442);
    });
  });

  describe('boundary validation', () => {
    it('throws RangeError for level 0', () => {
      expect(() => calculateStats(mockFighter, 0)).toThrow(RangeError);
    });

    it('throws RangeError for level 19', () => {
      expect(() => calculateStats(mockFighter, 19)).toThrow(RangeError);
    });

    it('throws RangeError for negative levels', () => {
      expect(() => calculateStats(mockFighter, -1)).toThrow(RangeError);
    });
  });
});

describe('applyItems', () => {
  it('adds item stats on top of base stats', () => {
    const base = calculateStats(mockFighter, 1);
    const withItems = applyItems(base, [
      { stats: { max_health: 150, physical_power: 40 } },
    ]);
    expect(withItems.max_health).toBe(600 + 150);
    expect(withItems.physical_power).toBe(55 + 40);
  });

  it('stacks multiple items additively', () => {
    const base = calculateStats(mockFighter, 1);
    const withItems = applyItems(base, [
      { stats: { physical_power: 40 } },
      { stats: { physical_power: 30 } },
    ]);
    expect(withItems.physical_power).toBe(55 + 40 + 30);
  });

  it('adds stats not present on the hero base (e.g. ability_haste)', () => {
    const base = calculateStats(mockFighter, 1);
    const withItems = applyItems(base, [
      { stats: { ability_haste: 10, critical_chance: 20 } },
    ]);
    expect(withItems.ability_haste).toBe(10);
    expect(withItems.critical_chance).toBe(20);
  });

  it('does not mutate the original base StatBlock', () => {
    const base = calculateStats(mockFighter, 1);
    const original = base.max_health;
    applyItems(base, [{ stats: { max_health: 200 } }]);
    expect(base.max_health).toBe(original);
  });

  it('returns the base unchanged when no items provided', () => {
    const base = calculateStats(mockFighter, 1);
    const result = applyItems(base, []);
    expect(result).toEqual(base);
  });
});
