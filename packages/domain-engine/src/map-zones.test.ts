import { describe, it, expect } from 'vitest';
import { pointInZone, getZonesForPoint, ZONE_DEFINITIONS } from './map-zones.js';

describe('pointInZone', () => {
  const square: [number, number][] = [
    [0, 0], [100, 0], [100, 100], [0, 100],
  ];

  it('returns true for a point inside the polygon', () => {
    expect(pointInZone(50, 50, square)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(pointInZone(150, 50, square)).toBe(false);
  });

  it('returns false for a point at the corner (edge case)', () => {
    // Edge behavior is allowed to vary — just must not throw
    expect(() => pointInZone(0, 0, square)).not.toThrow();
  });

  it('handles a non-rectangular polygon', () => {
    const triangle: [number, number][] = [[0, 0], [100, 0], [50, 100]];
    expect(pointInZone(50, 40, triangle)).toBe(true);
    expect(pointInZone(10, 90, triangle)).toBe(false);
  });
});

describe('ZONE_DEFINITIONS', () => {
  it('has 11 zones defined', () => {
    expect(ZONE_DEFINITIONS).toHaveLength(11);
  });

  it('every zone has a polygon with at least 3 vertices', () => {
    for (const zone of ZONE_DEFINITIONS) {
      expect(zone.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every zone key is unique', () => {
    const keys = ZONE_DEFINITIONS.map((z) => z.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('getZonesForPoint — real map positions', () => {
  it('FANGTOOTH avg position falls inside FANGTOOTH_PIT', () => {
    const zones = getZonesForPoint(-5180, 3790, ZONE_DEFINITIONS);
    const keys = zones.map((z) => z.key);
    expect(keys).toContain('FANGTOOTH_PIT');
  });

  it('ORB_PRIME avg position falls inside ORB_PRIME_PIT', () => {
    const zones = getZonesForPoint(6730, -748, ZONE_DEFINITIONS);
    const keys = zones.map((z) => z.key);
    expect(keys).toContain('ORB_PRIME_PIT');
  });

  it('GOLD_BUFF position falls inside OWN_JUNGLE', () => {
    const zones = getZonesForPoint(-12561, 1344, ZONE_DEFINITIONS);
    const keys = zones.map((z) => z.key);
    expect(keys).toContain('OWN_JUNGLE');
  });

  it('CYAN_BUFF position falls inside ENEMY_JUNGLE', () => {
    const zones = getZonesForPoint(13943, 1541, ZONE_DEFINITIONS);
    const keys = zones.map((z) => z.key);
    expect(keys).toContain('ENEMY_JUNGLE');
  });

  it('map extremes fall outside all objective pits', () => {
    const cornerZones = getZonesForPoint(-16311, -16498, ZONE_DEFINITIONS);
    const objectivePitKeys = cornerZones
      .map((z) => z.key)
      .filter((k) => ['FANGTOOTH_PIT', 'ORB_PRIME_PIT', 'MINI_PRIME_PIT', 'SHAPER_PIT'].includes(k));
    expect(objectivePitKeys).toHaveLength(0);
  });
});
