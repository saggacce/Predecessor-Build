import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  matchPlayerFindFirst: vi.fn(),
  matchPlayerFindMany: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: { matchPlayer: { findFirst: mocks.matchPlayerFindFirst, findMany: mocks.matchPlayerFindMany } },
}));

import { getPlayerMatchCoachAnalysis } from './player-match-coach-service.js';

describe('player match coach analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.matchPlayerFindMany.mockResolvedValue([
      { team: 'DUSK', abilityOrder: [{ ability: 'Q', gameTime: 60 }, { ability: 'E', gameTime: 120 }], match: { winningTeam: 'DUSK' } },
      { team: 'DAWN', abilityOrder: [{ ability: 'Q', gameTime: 60 }, { ability: 'E', gameTime: 120 }], match: { winningTeam: 'DAWN' } },
    ]);
    mocks.matchPlayerFindFirst.mockResolvedValue({
      id: 'mp-1', matchId: 'match-1', playerId: 'player-1', playerName: 'Player', team: 'DUSK', role: 'SUPPORT', heroSlug: 'dekker',
      kills: 1, deaths: 8, assists: 5, gold: 8_000, heroDamage: 10_000, laneMinionsKilled: 30,
      wardsPlaced: 9, totalDamageDealtToObjectives: 1_000,
      goldEarnedAtInterval: [500, 900, 1300, 1800, 2300, 2800, 3300, 3800, 4300, 4800, 5300, 5800, 6300, 6800, 7300],
      abilityOrder: [{ ability: 'Q', gameTime: 60 }, { ability: 'E', gameTime: 120 }],
      match: {
        duration: 1800, winningTeam: 'DAWN',
        matchPlayers: [
          { id: 'mp-1', playerId: 'player-1', team: 'DUSK', role: 'SUPPORT', kills: 1, deaths: 8, assists: 5, goldEarnedAtInterval: [] },
          { id: 'ally-1', playerId: 'ally-1', team: 'DUSK', role: 'CARRY', kills: 8, deaths: 3, assists: 2, goldEarnedAtInterval: [] },
          { id: 'ally-2', playerId: 'ally-2', team: 'DUSK', role: 'JUNGLE', kills: 3, deaths: 4, assists: 6, goldEarnedAtInterval: [] },
          { id: 'enemy-1', playerId: 'enemy-1', team: 'DAWN', role: 'SUPPORT', kills: 2, deaths: 2, assists: 12, goldEarnedAtInterval: [500, 1000, 1500, 2100, 2700, 3300, 3900, 4500, 5100, 5700, 6300, 6900, 7500, 8100, 8700] },
        ],
        heroKills: [
          { killedPlayerId: 'player-1', gameTime: 530, locationX: 10, locationY: 20 },
          { killedPlayerId: 'player-1', gameTime: 1160, locationX: 30, locationY: 40 },
        ],
        objectiveKills: [
          { entityType: 'FANGTOOTH', gameTime: 600, killerTeam: 'DAWN', killerPlayerId: 'enemy-1' },
          { entityType: 'ORB_PRIME', gameTime: 1200, killerTeam: 'DAWN', killerPlayerId: 'enemy-1' },
        ],
        structureDestructions: [],
        wardEvents: [{ playerId: 'player-1', eventType: 'PLACEMENT', gameTime: 450 }],
      },
    });
  });

  it('prioritizes one evidence-backed lesson and keeps educational exceptions', async () => {
    const result = await getPlayerMatchCoachAnalysis('match-1', 'mp-1');

    expect(result.summary.headline).toContain('objetivos');
    expect(result.summary.secondaryInsights.length).toBeLessThanOrEqual(2);
    expect(result.summary.secondaryInsights).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ title: result.summary.positive.title }),
    ]));
    expect(result.sections.objectives).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'tempo-deaths-before-objectives',
        priority: 'primary',
        evidence: expect.stringContaining('90 segundos'),
        action: expect.any(String),
        exception: expect.any(String),
        transferExamples: expect.any(Array),
      }),
    ]));
    expect(result.sections.abilities[0]).toMatchObject({ id: 'abilities-progression' });
    expect(result.coverage.disclaimer).toContain('inferencias');
  });
});
