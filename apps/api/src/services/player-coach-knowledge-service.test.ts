import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  db: {
    version: { findFirst: vi.fn() },
    heroMeta: { findMany: vi.fn() },
    gameItem: { findMany: vi.fn() },
    gamePerkVersion: { findMany: vi.fn() },
  },
}));

import { db } from '../db.js';
import { getPlayerCoachKnowledge } from './player-coach-knowledge-service.js';

const recentMatch = {
  heroSlug: 'dekker',
  role: 'SUPPORT',
  inventoryItems: ['tainted-totem'],
  perks: [{ id: 'perk-data-1', displayName: 'Guardian', slot: 'ETERNAL_1' }],
  match: { predggUuid: 'match-1', versionId: 'version-1', version: { name: '1.16.3' } },
};

describe('player coach knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.version.findFirst).mockResolvedValue({ id: 'version-1', name: '1.16.3' } as never);
    vi.mocked(db.heroMeta.findMany).mockResolvedValue([{
      slug: 'dekker', displayName: 'Dekker', roles: ['Support'], classes: ['Controller'],
      abilities: [{ display_name: 'Containment Fence', menu_description: 'Creates a circular fence.' }],
    }] as never);
    vi.mocked(db.gameItem.findMany).mockResolvedValue([{
      slug: 'tainted-totem', name: 'Tainted Totem',
      versions: [{ displayName: 'Tainted Totem', totalPrice: 2800, stats: [{ stat: 'armor', value: 30 }], effects: [{ name: 'Blighted', text: 'Reduces healing.' }] }],
    }] as never);
    vi.mocked(db.gamePerkVersion.findMany).mockResolvedValue([{
      displayName: 'Guardian', slot: 'ETERNAL_1', simpleDescription: 'Protect an ally.', description: 'Protect an ally.', heroSlug: null,
    }] as never);
  });

  it('combines reviewed fundamentals with patch-aware catalog knowledge', async () => {
    const result = await getPlayerCoachKnowledge('¿Por qué necesito anti-curación en mi build?', [recentMatch]);

    expect(result.some((entry) => entry.label === 'Anti-curación')).toBe(true);
    expect(result.some((entry) => entry.kind === 'hero' && entry.label.includes('Dekker'))).toBe(true);
    expect(result.some((entry) => entry.kind === 'item' && entry.patch === '1.16.3')).toBe(true);
    expect(result.some((entry) => entry.kind === 'loadout' && entry.patch === '1.16.3')).toBe(true);
  });

  it('adds the player role foundation even when the question is generic', async () => {
    const result = await getPlayerCoachKnowledge('¿Qué debo mejorar?', [recentMatch]);

    expect(result.some((entry) => entry.label === 'Fundamentos de Support')).toBe(true);
    expect(result.every((entry) => entry.id.startsWith('K'))).toBe(true);
  });

  it('discloses the nearest available catalog when the match patch has no catalog', async () => {
    vi.mocked(db.version.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'version-fallback', name: '1.16.1' } as never);

    const result = await getPlayerCoachKnowledge('Explícame mi objeto', [recentMatch]);

    expect(db.gameItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ versions: expect.objectContaining({ where: { versionId: 'version-fallback' } }) }),
    }));
    expect(result.find((entry) => entry.kind === 'item')?.patch).toBe('1.16.1');
  });
});
