import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  playerFindUnique: vi.fn(),
  matchPlayerFindMany: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    player: { findUnique: mocks.playerFindUnique },
    matchPlayer: { findMany: mocks.matchPlayerFindMany },
  },
}));

import { getPlayerChampionPoolContext } from './player-champion-pool-service.js';

describe('player champion pool context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.playerFindUnique.mockResolvedValue({ id: 'player-1', displayName: 'CoachMe', customName: null });
    mocks.matchPlayerFindMany.mockResolvedValue([
      {
        id: 'own-1', role: 'SUPPORT', heroSlug: 'dekker', team: 'DAWN', kills: 1, deaths: 2, assists: 12,
        match: { gameMode: 'RANKED', winningTeam: 'DAWN', matchPlayers: [
          { id: 'own-1', team: 'DAWN', heroSlug: 'dekker', role: 'SUPPORT' },
          { id: 'ally-1', team: 'DAWN', heroSlug: 'murdock', role: 'CARRY' },
          { id: 'enemy-1', team: 'DUSK', heroSlug: 'riktor', role: 'SUPPORT' },
        ] },
      },
      {
        id: 'own-2', role: 'SUPPORT', heroSlug: 'dekker', team: 'DUSK', kills: 0, deaths: 4, assists: 8,
        match: { gameMode: 'RANKED', winningTeam: 'DAWN', matchPlayers: [
          { id: 'own-2', team: 'DUSK', heroSlug: 'dekker', role: 'SUPPORT' },
          { id: 'ally-2', team: 'DUSK', heroSlug: 'murdock', role: 'CARRY' },
          { id: 'enemy-2', team: 'DAWN', heroSlug: 'riktor', role: 'SUPPORT' },
        ] },
      },
      {
        id: 'own-3', role: 'MIDLANE', heroSlug: 'gideon', team: 'DAWN', kills: 7, deaths: 1, assists: 5,
        match: { gameMode: 'STANDARD', winningTeam: 'DAWN', matchPlayers: [
          { id: 'own-3', team: 'DAWN', heroSlug: 'gideon', role: 'MIDLANE' },
          { id: 'enemy-3', team: 'DUSK', heroSlug: 'morigesh', role: 'MIDLANE' },
        ] },
      },
    ]);
  });

  it('filters the pool and aggregates personal enemy matchups and ally synergies', async () => {
    const result = await getPlayerChampionPoolContext('player-1', { days: 90, role: 'SUPPORT', gameMode: 'RANKED', heroSlug: 'dekker' });

    expect(result.sampleSize).toBe(2);
    expect(result.heroes[0]).toMatchObject({ heroSlug: 'dekker', matches: 2, wins: 1, winRate: 50 });
    expect(result.matchups[0]).toMatchObject({ heroSlug: 'riktor', matches: 2, wins: 1, winRate: 50 });
    expect(result.synergies[0]).toMatchObject({ heroSlug: 'murdock', matches: 2, wins: 1, winRate: 50 });
    expect(result.filters.available.roles).toEqual(['MIDLANE', 'SUPPORT']);
    expect(result.strongestMatchup?.heroSlug).toBe('riktor');
    expect(result.hardestMatchup?.heroSlug).toBe('riktor');
  });
});
