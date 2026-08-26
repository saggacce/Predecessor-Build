import { describe, expect, it } from 'vitest';
import { buildLiveDetail } from './matches.js';

describe('buildLiveDetail', () => {
  it('ignores null and empty inventory slots returned by pred.gg', () => {
    const result = buildLiveDetail({
      match: {
        uuid: 'match-1',
        matchPlayers: [
          {
            player: { id: 'player-1', name: 'Player One' },
            team: 'DUSK',
            hero: { slug: 'murdock' },
            inventoryItemData: [
              null,
              { item: null },
              { item: { slug: '' } },
              { item: { slug: 'lightning-hawk' } },
            ],
          },
        ],
      },
    });

    expect(result.detail.dusk).toHaveLength(1);
    expect(result.detail.dusk[0].inventoryItems).toEqual(['lightning-hawk']);
  });
});
