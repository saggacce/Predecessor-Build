import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  matchPlayerFindFirst: vi.fn(),
  gameItemFindMany: vi.fn(),
  gameItemVersionFindMany: vi.fn(),
  transactionFindMany: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    matchPlayer: { findFirst: mocks.matchPlayerFindFirst },
    gameItem: { findMany: mocks.gameItemFindMany },
    gameItemVersion: { findMany: mocks.gameItemVersionFindMany },
    transaction: { findMany: mocks.transactionFindMany },
  },
}));

import { getMatchBuildAnalysis } from './build-coach-service.js';

describe('contextual build coach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.matchPlayerFindFirst.mockResolvedValue({
      id: 'mp-1', matchId: 'match-1', playerId: 'player-1', heroSlug: 'dekker', role: 'SUPPORT', team: 'DAWN',
      kills: 0, deaths: 7, assists: 10, inventoryItems: ['offensive-item'], perks: [], abilityOrder: [],
      heroDamage: 10_000, totalHealingDone: 2_000, totalShieldingReceived: 1_000,
      physicalDamageTakenFromHeroes: 18_000, physicalDamageTaken: 19_000,
      magicalDamageTakenFromHeroes: 4_000, magicalDamageTaken: 4_500,
      trueDamageTakenFromHeroes: 0, trueDamageTaken: 0,
      match: {
        versionId: 'version-1', winningTeam: 'DUSK',
        matchPlayers: [
          { id: 'mp-1', playerId: 'player-1', playerName: 'Coach', team: 'DAWN', role: 'SUPPORT', heroSlug: 'dekker', totalHealingDone: 2_000, totalShieldingReceived: 1_000, totalDamageMitigated: 8_000 },
          { id: 'enemy-1', playerId: 'enemy-player-1', playerName: 'Enemy', team: 'DUSK', role: 'SUPPORT', heroSlug: 'narbash', totalHealingDone: 20_000, totalShieldingReceived: 2_000, totalDamageMitigated: 25_000 },
        ],
      },
    });
    mocks.gameItemFindMany.mockResolvedValue([{ predggId: 'item-1', slug: 'offensive-item', name: 'Offense', versions: [{
      predggDataId: 'data-1', displayName: 'Offense', aggressionType: 'OFFENSE', rarity: 'EPIC', slotType: 'PASSIVE',
      isEvolved: false, isHidden: false, stats: [], effects: [], blocksIds: ['data-1'], blockedByIds: ['data-1'],
    }] }]);
    mocks.gameItemVersionFindMany.mockResolvedValue([
      { displayName: 'Physical Guard', aggressionType: 'ARMOR', totalPrice: 3000, stats: [], effects: [], item: { slug: 'physical-guard', name: 'PhysicalGuard' } },
      { displayName: 'Tainted Guard', aggressionType: 'ANTI_HEAL', totalPrice: 3100, stats: [], effects: [], item: { slug: 'tainted-guard', name: 'TaintedGuard' } },
    ]);
    mocks.transactionFindMany.mockResolvedValue([
      { gameTime: 720, transactionType: 'BUY', itemName: 'Offense', playerId: 'player-1', team: 'DAWN' },
      { gameTime: 850, transactionType: 'BUY', itemName: 'PhysicalGuard', playerId: 'enemy-player-1', team: 'DUSK' },
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
    expect(result.verdict.grade).toBe('poor');
    expect(result.recommendedBuild.changes.find((change) => change.signalKey === 'anti-heal')?.why).toContain('narbash');
    expect(result.purchaseTimeline.ownPurchases[0]).toMatchObject({ minute: '12:00', itemName: 'Offense' });
    expect(result.purchaseTimeline.opponentResponses[0]).toMatchObject({ heroSlug: 'narbash', minute: '14:10' });
    expect(result.signals).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'item-conflict' }),
    ]));
    expect(mocks.gameItemVersionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ rarity: 'EPIC', slotType: 'PASSIVE' }),
    }));
  });

  it('credits an existing shred item and flags a farm-scaling Eternal for Support', async () => {
    mocks.matchPlayerFindFirst.mockResolvedValueOnce({
      id: 'mp-1', matchId: 'match-1', playerId: 'player-1', heroSlug: 'dekker', role: 'SUPPORT', team: 'DAWN',
      kills: 0, deaths: 5, assists: 8, heroDamage: 10_000,
      totalHealingDone: 2_500, totalShieldingReceived: 1_000,
      inventoryItems: ['dynamo'], abilityOrder: [],
      perks: [{
        id: '699', name: 'Eternal_Xyris', displayName: 'Xyris', slot: 'ETERNAL_1',
        description: 'Deal +3% Damage. Gain more per 10 Units killed.',
      }],
      physicalDamageTakenFromHeroes: 10_000, physicalDamageTaken: 10_000,
      magicalDamageTakenFromHeroes: 10_000, magicalDamageTaken: 10_000,
      trueDamageTakenFromHeroes: 0, trueDamageTaken: 0,
      match: {
        versionId: 'version-1', winningTeam: 'DUSK',
        matchPlayers: [
          { id: 'mp-1', playerId: 'player-1', playerName: 'Coach', team: 'DAWN', role: 'SUPPORT', heroSlug: 'dekker', totalHealingDone: 2_500, totalShieldingReceived: 1_000, totalDamageMitigated: 8_000 },
          { id: 'enemy-1', playerId: 'enemy-player-1', playerName: 'Enemy', team: 'DUSK', role: 'OFFLANE', heroSlug: 'akeron', totalHealingDone: 0, totalShieldingReceived: 0, totalDamageMitigated: 100_000 },
        ],
      },
    });
    mocks.gameItemFindMany.mockResolvedValueOnce([{ predggId: 'item-1', slug: 'dynamo', name: 'Dynamo', versions: [{
      predggDataId: 'data-1', displayName: 'Dynamo', aggressionType: 'MAGICAL_SHRED', rarity: 'EPIC', slotType: 'PASSIVE',
      isEvolved: false, isHidden: false, stats: [], effects: [], blocksIds: [], blockedByIds: [],
    }] }]);
    mocks.transactionFindMany.mockResolvedValueOnce([]);

    const result = await getMatchBuildAnalysis('match-1', 'mp-1');

    expect(result.signals).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'anti-tank' })]));
    expect(result.inventoryAssessments[0]).toMatchObject({ slug: 'dynamo', verdict: 'correct' });
    expect(result.eternalLoadout[0]).toMatchObject({ displayName: 'Xyris', verdict: 'questionable' });
  });
});
