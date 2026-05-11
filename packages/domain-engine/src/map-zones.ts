// ── Map zone definitions and point-in-polygon utility ────────────────────────
//
// Coordinate system: game space units, same as HeroKill/WardEvent/ObjectiveKill
// MAP_BOUNDS = { minX: -16311, maxX: 17637, minY: -16498, maxY: 20026 }
//
// Objective anchor positions (from ObjectiveKill DB averages):
//   FANGTOOTH/PRIMAL_FANGTOOTH : (-5180, 3790)
//   ORB_PRIME/MINI_PRIME       : (6730, -748)
//   GOLD_BUFF (DUSK jungle)    : (-12561, 1344)
//   CYAN_BUFF (DAWN jungle)    : (13943, 1541)
//   Center objectives          : (~660, 1520)
//
// Axis orientation: +X = right, +Y = up (DUSK base top-left, DAWN base bottom-right)

export type Polygon = [number, number][];

export interface ZoneDefinition {
  key: string;
  name: string;
  zoneType: 'objective' | 'lane' | 'jungle' | 'river';
  relatedObjective: string | null;
  polygon: Polygon;
}

// Ray casting algorithm — O(n) where n = polygon vertices
export function pointInZone(x: number, y: number, polygon: Polygon): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function getZonesForPoint(
  x: number,
  y: number,
  zones: ZoneDefinition[],
): ZoneDefinition[] {
  return zones.filter((z) => pointInZone(x, y, z.polygon));
}

// ── Zone definitions ──────────────────────────────────────────────────────────
// Polygons are rectangles [topLeft, topRight, bottomRight, bottomLeft] in game coords.
// Each can be refined by overlaying with actual replay data.

export const ZONE_DEFINITIONS: ZoneDefinition[] = [
  // ── Objective pits (anchored on avg ObjectiveKill positions) ──────────────
  {
    key: 'FANGTOOTH_PIT',
    name: 'Fangtooth Pit',
    zoneType: 'objective',
    relatedObjective: 'FANGTOOTH',
    // Centered on (-5180, 3790) ±2100 units
    polygon: [[-7300, 1700], [-3100, 1700], [-3100, 5900], [-7300, 5900]],
  },
  {
    key: 'FANGTOOTH_ENTRANCES',
    name: 'Fangtooth Approach Corridors',
    zoneType: 'objective',
    relatedObjective: 'FANGTOOTH',
    // Wider zone covering approach paths to Fangtooth
    polygon: [[-9500, 500], [-1500, 500], [-1500, 7500], [-9500, 7500]],
  },
  {
    key: 'ORB_PRIME_PIT',
    name: 'Orb Prime Pit',
    zoneType: 'objective',
    relatedObjective: 'ORB_PRIME',
    // Centered on (6730, -748) ±2100 units
    polygon: [[4600, -2900], [8800, -2900], [8800, 1400], [4600, 1400]],
  },
  {
    key: 'MINI_PRIME_PIT',
    name: 'Mini Prime Pit',
    zoneType: 'objective',
    relatedObjective: 'MINI_PRIME',
    // Shares spawn with Orb Prime
    polygon: [[4600, -2900], [8800, -2900], [8800, 1400], [4600, 1400]],
  },
  {
    key: 'SHAPER_PIT',
    name: 'Shaper / Genesis Core Area',
    zoneType: 'objective',
    relatedObjective: 'SHAPER',
    // Center of map — Shaper spawns near map center
    polygon: [[-1800, -800], [3000, -800], [3000, 3800], [-1800, 3800]],
  },

  // ── Jungle zones (anchored on buff positions) ─────────────────────────────
  {
    key: 'OWN_JUNGLE',
    name: 'DUSK Jungle (left side)',
    zoneType: 'jungle',
    relatedObjective: null,
    // Covers left side between lanes; GOLD_BUFF at (-12561, 1344)
    polygon: [[-16311, -3500], [-2500, -3500], [-2500, 6500], [-16311, 6500]],
  },
  {
    key: 'ENEMY_JUNGLE',
    name: 'DAWN Jungle (right side)',
    zoneType: 'jungle',
    relatedObjective: null,
    // Covers right side between lanes; CYAN_BUFF at (13943, 1541)
    polygon: [[2500, -3500], [17637, -3500], [17637, 6500], [2500, 6500]],
  },

  // ── Lane zones (estimated from outer/inner tower Y ranges) ───────────────
  {
    key: 'OFFLANE',
    name: 'Offlane (Top Lane)',
    zoneType: 'lane',
    relatedObjective: null,
    // Outer towers reach Y≈7200; top lane continues toward DUSK base at high Y
    polygon: [[-16311, 6500], [17637, 6500], [17637, 20026], [-16311, 20026]],
  },
  {
    key: 'DUO_LANE',
    name: 'Duo Lane (Bottom Lane)',
    zoneType: 'lane',
    relatedObjective: null,
    // Outer towers reach Y≈-4290; bottom lane continues toward DAWN base at low Y
    polygon: [[-16311, -16498], [17637, -16498], [17637, -3500], [-16311, -3500]],
  },
  {
    key: 'MID_LANE',
    name: 'Mid Lane',
    zoneType: 'lane',
    relatedObjective: null,
    // Center corridor between the two objective pits
    polygon: [[-3000, -2000], [3000, -2000], [3000, 5000], [-3000, 5000]],
  },

  // ── River / central objectives area ──────────────────────────────────────
  {
    key: 'RIVER_BUFF_AREAS',
    name: 'River & Central Buff Area',
    zoneType: 'river',
    relatedObjective: null,
    // Central area where Red/Blue/Seedling/River creatures spawn (~660, 1520)
    polygon: [[-3000, -1000], [3000, -1000], [3000, 4000], [-3000, 4000]],
  },
];
