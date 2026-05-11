import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repairEventStreamPlayerIds, syncMatchEventStream } from './sync-service.js';

function createMockDb() {
  return {
    match: {
      findUnique: vi.fn().mockResolvedValue({ eventStreamSynced: false }),
      update: vi.fn().mockResolvedValue({}),
    },
    heroKill: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    objectiveKill: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    structureDestruction: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    wardEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    transaction: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    heroBan: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    matchPlayer: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    player: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'internal-killer', predggId: 'predgg-killer' },
        { id: 'internal-warder', predggId: 'predgg-warder' },
      ]),
      upsert: vi.fn().mockResolvedValue({ id: 'internal-created', predggId: 'predgg-created' }),
    },
    syncLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (queries) => Promise.all(queries)),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        match: {
          heroKills: [
            {
              gameTime: 100,
              killerTeam: 'BLUE',
              killedTeam: 'RED',
              killerPlayer: { id: 'predgg-killer' },
              killedPlayer: { id: 'predgg-created' },
              killerHero: { slug: 'riktor' },
              killedHero: { slug: 'dekker' },
              location: { x: 1, y: 2, z: 3 },
            },
          ],
          objectiveKills: [
            {
              gameTime: 300,
              killedEntityType: 'FANGTOOTH',
              killerTeam: 'BLUE',
              killerPlayer: { id: 'predgg-killer' },
              location: { x: 4, y: 5, z: 6 },
            },
          ],
          structureDestructions: [],
          heroBans: [],
          matchPlayers: [
            {
              player: { id: 'predgg-warder' },
              team: 'BLUE',
              goldEarnedAtInterval: [100, 200],
              wardPlacements: [{ gameTime: 50, type: 'WARD', location: { x: 1, y: 1, z: 0 } }],
              wardDestructions: [],
              transactions: [],
            },
          ],
        },
      },
    }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncMatchEventStream', () => {
  it('stores event-stream player references as internal Player.id values and creates placeholders', async () => {
    const mockDb = createMockDb();

    await syncMatchEventStream(mockDb as never, 'match-1', 'predgg-match-1', 'token');

    expect(mockDb.player.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { predggId: 'predgg-created' },
      create: expect.objectContaining({
        predggId: 'predgg-created',
        predggUuid: 'predgg-created',
        displayName: 'Unknown Player',
      }),
    }));
    expect(mockDb.heroKill.createMany.mock.calls[0][0].data[0]).toMatchObject({
      killerPlayerId: 'internal-killer',
      killedPlayerId: 'internal-created',
    });
    expect(mockDb.objectiveKill.createMany.mock.calls[0][0].data[0]).toMatchObject({
      killerPlayerId: 'internal-killer',
    });
    expect(mockDb.wardEvent.createMany.mock.calls[0][0].data[0]).toMatchObject({
      playerId: 'internal-warder',
    });
    expect(mockDb.matchPlayer.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', predggPlayerUuid: 'predgg-warder' },
      data: { goldEarnedAtInterval: [100, 200] },
    });
  });
});

describe('repairEventStreamPlayerIds', () => {
  it('rewrites existing pred.gg player IDs to internal IDs without changing already-internal IDs', async () => {
    const mockDb = createMockDb();
    mockDb.player.findMany.mockResolvedValue([
      { id: 'internal-killer', predggId: 'predgg-killer' },
      { id: 'already-internal', predggId: 'other-predgg-id' },
      { id: 'internal-warder', predggId: 'predgg-warder' },
    ]);
    mockDb.heroKill.findMany.mockResolvedValue([
      { id: 'hk-1', killerPlayerId: 'predgg-killer', killedPlayerId: 'already-internal' },
    ]);
    mockDb.objectiveKill.findMany.mockResolvedValue([
      { id: 'ok-1', killerPlayerId: 'predgg-killer' },
    ]);
    mockDb.wardEvent.findMany.mockResolvedValue([
      { id: 'we-1', playerId: 'predgg-warder' },
    ]);

    const result = await repairEventStreamPlayerIds(mockDb as never);

    expect(mockDb.heroKill.update).toHaveBeenCalledWith({
      where: { id: 'hk-1' },
      data: { killerPlayerId: 'internal-killer', killedPlayerId: 'already-internal' },
    });
    expect(mockDb.objectiveKill.update).toHaveBeenCalledWith({
      where: { id: 'ok-1' },
      data: { killerPlayerId: 'internal-killer' },
    });
    expect(mockDb.wardEvent.update).toHaveBeenCalledWith({
      where: { id: 'we-1' },
      data: { playerId: 'internal-warder' },
    });
    expect(result).toEqual({
      heroKillsUpdated: 1,
      objectiveKillsUpdated: 1,
      wardEventsUpdated: 1,
      placeholdersCreated: 0,
    });
  });
});
