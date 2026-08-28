import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  matchPlayerFindFirst: vi.fn(),
  gameItemFindMany: vi.fn(),
  gameItemVersionFindMany: vi.fn(),
  gamePerkVersionFindMany: vi.fn(),
  heroMetaFindMany: vi.fn(),
  transactionFindMany: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    matchPlayer: { findFirst: mocks.matchPlayerFindFirst },
    gameItem: { findMany: mocks.gameItemFindMany },
    gameItemVersion: { findMany: mocks.gameItemVersionFindMany },
    gamePerkVersion: { findMany: mocks.gamePerkVersionFindMany },
    heroMeta: { findMany: mocks.heroMetaFindMany },
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
    mocks.heroMetaFindMany.mockResolvedValue([
      { slug: 'dekker', displayName: 'Dekker', abilities: [] },
      { slug: 'narbash', displayName: 'Narbash', abilities: [
        { display_name: 'Song of My People', game_description: 'Heal nearby allied heroes over time.' },
        { display_name: 'Thunk', game_description: 'Throw a projectile that stuns the first enemy Hero hit.' },
      ] },
    ]);
    mocks.gamePerkVersionFindMany.mockResolvedValue([]);
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
    expect(result.recommendedBuild.changes.find((change) => change.signalKey === 'anti-heal')?.why.toLowerCase()).toContain('narbash');
    expect(result.signals.find((signal) => signal.key === 'anti-heal')).toMatchObject({
      whyItMatters: expect.stringContaining('Heridas Graves'),
      sources: [expect.objectContaining({ heroSlug: 'narbash', name: 'Song of My People' })],
    });
    expect(result.globalAnalysis.playerIdentity).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'TEAM_UTILITY' })]));
    expect(result.globalAnalysis.enemyThreats).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'SUSTAIN' }),
      expect.objectContaining({ key: 'CONTROL', sources: [expect.objectContaining({ name: 'Thunk' })] }),
    ]));
    expect(result.inventoryAssessments[0]).toEqual(expect.objectContaining({ roleFit: expect.any(String), matchupFit: expect.any(String), tradeoff: expect.any(String) }));
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
    mocks.gamePerkVersionFindMany.mockResolvedValueOnce([
      { predggDataId: 'augment-data', displayName: 'Ionic Surge', slot: 'HERO_SPECIFIC_1', icon: null, simpleDescription: null, description: 'Stunning a Hero shreds their Physical and Magical Armor.', heroSlug: 'dekker', minorBlessingPredggIds: [], perk: { predggId: 'augment-1', slug: 'ionic-surge' } },
      { predggDataId: 'xyris-data', displayName: 'Xyris', slot: 'ETERNAL_1', icon: null, simpleDescription: null, description: 'Gain damage per 10 Units killed.', heroSlug: null, minorBlessingPredggIds: [], perk: { predggId: '699', slug: 'xyris' } },
      { predggDataId: 'knell-data', displayName: 'Knell', slot: 'ETERNAL_1', icon: null, simpleDescription: null, description: 'Abilities apply Rust and shred Physical and Magical Armor.', heroSlug: null, minorBlessingPredggIds: ['frequency', 'peal'], perk: { predggId: 'knell', slug: 'knell' } },
      { predggDataId: 'frequency-data', displayName: 'Frequency', slot: 'BLESSING_MINOR_1', icon: null, simpleDescription: null, description: 'Gain Ability Haste per Rust stack.', heroSlug: null, minorBlessingPredggIds: [], perk: { predggId: 'frequency', slug: 'frequency' } },
      { predggDataId: 'peal-data', displayName: 'Peal', slot: 'BLESSING_MINOR_2', icon: null, simpleDescription: null, description: 'After your Ultimate apply maximum Rust.', heroSlug: null, minorBlessingPredggIds: [], perk: { predggId: 'peal', slug: 'peal' } },
    ]);
    mocks.transactionFindMany.mockResolvedValueOnce([]);

    const result = await getMatchBuildAnalysis('match-1', 'mp-1');

    expect(result.signals).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'anti-tank' })]));
    expect(result.inventoryAssessments[0]).toMatchObject({ slug: 'dynamo', verdict: 'correct' });
    expect(result.eternalLoadout[0]).toMatchObject({ displayName: 'Xyris', verdict: 'questionable' });
    expect(result.recommendedLoadout.augment).toMatchObject({ displayName: 'Ionic Surge' });
    expect(result.recommendedLoadout.eternal).toMatchObject({ displayName: 'Knell', replaces: { displayName: 'Xyris' } });
    expect(result.recommendedLoadout.blessings.map((perk) => perk.displayName)).toEqual(['Frequency', 'Peal']);
  });
});
