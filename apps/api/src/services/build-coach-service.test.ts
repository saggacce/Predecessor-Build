import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  matchPlayerFindFirst: vi.fn(),
  gameItemFindMany: vi.fn(),
  gameItemVersionFindMany: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    matchPlayer: { findFirst: mocks.matchPlayerFindFirst },
    gameItem: { findMany: mocks.gameItemFindMany },
    gameItemVersion: { findMany: mocks.gameItemVersionFindMany },
  },
}));

import { getMatchBuildAnalysis } from './build-coach-service.js';

describe('contextual build coach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.matchPlayerFindFirst.mockResolvedValue({
      id: 'mp-1', matchId: 'match-1', heroSlug: 'dekker', role: 'SUPPORT', team: 'DAWN',
      kills: 0, deaths: 7, assists: 10, inventoryItems: ['offensive-item'], perks: [], abilityOrder: [],
      physicalDamageTakenFromHeroes: 18_000, physicalDamageTaken: 19_000,
      magicalDamageTakenFromHeroes: 4_000, magicalDamageTaken: 4_500,
      trueDamageTakenFromHeroes: 0, trueDamageTaken: 0,
      match: {
        versionId: 'version-1', winningTeam: 'DUSK',
        matchPlayers: [
          { id: 'mp-1', team: 'DAWN', role: 'SUPPORT', heroSlug: 'dekker', totalHealingDone: 2_000, totalShieldingReceived: 1_000, totalDamageMitigated: 8_000 },
          { id: 'enemy-1', team: 'DUSK', role: 'SUPPORT', heroSlug: 'narbash', totalHealingDone: 20_000, totalShieldingReceived: 2_000, totalDamageMitigated: 25_000 },
        ],
      },
    });
    mocks.gameItemFindMany.mockResolvedValue([{ predggId: 'item-1', slug: 'offensive-item', name: 'Offense', versions: [{
      displayName: 'Offense', aggressionType: 'OFFENSE', stats: [], effects: [], blocksIds: [], blockedByIds: [],
    }] }]);
    mocks.gameItemVersionFindMany.mockResolvedValue([
      { displayName: 'Physical Guard', aggressionType: 'ARMOR', totalPrice: 3000, item: { slug: 'physical-guard' } },
      { displayName: 'Tainted Guard', aggressionType: 'ANTI_HEAL', totalPrice: 3100, item: { slug: 'tainted-guard' } },
    ]);
  });

  it('turns damage composition and enemy healing into evidence-backed item signals', async () => {
    const result = await getMatchBuildAnalysis('match-1', 'mp-1');

    expect(result.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'physical-defense', severity: 'critical' }),
      expect.objectContaining({ key: 'anti-heal', severity: 'warning' }),
    ]));
    expect(result.signals.find((signal) => signal.key === 'physical-defense')?.suggestedItems?.[0]).toMatchObject({ slug: 'physical-guard' });
    expect(result.context.damageReceived.physical).toBe(18_000);
  });
});
