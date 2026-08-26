import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  playerFindUnique: vi.fn(),
  matchPlayerFindMany: vi.fn(),
  getMatchBuildAnalysis: vi.fn(),
}));

vi.mock('../db.js', () => ({
  db: {
    player: { findUnique: mocks.playerFindUnique },
    matchPlayer: { findMany: mocks.matchPlayerFindMany },
  },
}));

vi.mock('./build-coach-service.js', () => ({
  getMatchBuildAnalysis: mocks.getMatchBuildAnalysis,
}));

import { getPlayerBuildReview } from './player-build-review-service.js';

describe('player build review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.playerFindUnique.mockResolvedValue({ id: 'player-1' });
    mocks.matchPlayerFindMany.mockResolvedValue([{
      id: 'mp-1',
      matchId: 'match-1',
      match: {
        predggUuid: 'uuid-1', startTime: new Date('2026-08-25T18:00:00Z'), duration: 1800,
        gameMode: 'RANKED', version: { name: '1.16.1' },
      },
    }]);
    mocks.getMatchBuildAnalysis.mockResolvedValue({ heroSlug: 'dekker', signals: [] });
  });

  it('combines recent match context with build and Ancestor analysis', async () => {
    const result = await getPlayerBuildReview('player-1', { days: 30, limit: 3 });

    expect(mocks.matchPlayerFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(mocks.getMatchBuildAnalysis).toHaveBeenCalledWith('match-1', 'mp-1');
    expect(result.matches[0]).toMatchObject({
      match: { id: 'match-1', predggUuid: 'uuid-1', version: '1.16.1' },
      analysis: { heroSlug: 'dekker' },
    });
  });

  it('keeps the report usable when one match cannot be analysed', async () => {
    mocks.getMatchBuildAnalysis.mockRejectedValue(new Error('catalog missing'));

    const result = await getPlayerBuildReview('player-1');

    expect(result.matches).toEqual([]);
  });
});
