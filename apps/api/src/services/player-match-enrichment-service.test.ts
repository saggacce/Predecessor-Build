import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sync-service.js', () => ({
  resyncMatch: vi.fn().mockResolvedValue(undefined),
  syncMatchEventStream: vi.fn().mockResolvedValue(undefined),
}));

import { resyncMatch, syncMatchEventStream } from './sync-service.js';
import {
  enrichPlayerMatches,
  getPlayerMatchEnrichmentCoverage,
} from './player-match-enrichment-service.js';

describe('player match enrichment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates persistent 30-day coverage from match flags', async () => {
    const db = {
      match: {
        findMany: vi.fn().mockResolvedValue([
          { rosterSynced: true, eventStreamSynced: true, eventStreamFailed: false, syncedAt: new Date('2026-08-25T12:00:00Z') },
          { rosterSynced: true, eventStreamSynced: false, eventStreamFailed: true, syncedAt: new Date('2026-08-24T12:00:00Z') },
          { rosterSynced: false, eventStreamSynced: false, eventStreamFailed: false, syncedAt: new Date('2026-08-23T12:00:00Z') },
        ]),
      },
    };

    const coverage = await getPlayerMatchEnrichmentCoverage(db as never, 'player-1');

    expect(coverage).toMatchObject({
      playerId: 'player-1',
      totalMatches: 3,
      rosterSynced: 2,
      eventStreamSynced: 1,
      fullyEnriched: 1,
      failed: 1,
      pending: 2,
      coveragePercent: 33,
      lastMatchSyncedAt: '2026-08-25T12:00:00.000Z',
    });
    expect(db.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ matchPlayers: { some: { playerId: 'player-1' } } }),
    }));
  });

  it('enriches only the selected player matches and chooses the missing phase', async () => {
    const candidates = [
      { id: 'match-1', predggUuid: 'uuid-1', rosterSynced: false, eventStreamSynced: false, eventStreamFailed: false },
      { id: 'match-2', predggUuid: 'uuid-2', rosterSynced: true, eventStreamSynced: false, eventStreamFailed: false },
    ];
    const db = {
      match: {
        findMany: vi.fn().mockResolvedValue(candidates),
        findUnique: vi.fn().mockResolvedValue({ rosterSynced: true, eventStreamSynced: true }),
      },
      syncLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const result = await enrichPlayerMatches(db as never, 'player-1', 'token', { concurrency: 2 });

    expect(result).toEqual({ total: 2, processed: 2, succeeded: 2, errors: 0 });
    expect(resyncMatch).toHaveBeenCalledWith(db, 'uuid-1', 'token', true);
    expect(syncMatchEventStream).toHaveBeenCalledWith(db, 'match-2', 'uuid-2', 'token', false);
    expect(db.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ matchPlayers: { some: { playerId: 'player-1' } } }),
      take: 50,
    }));
  });

  it('continues after a partial failure and records it for diagnosis', async () => {
    vi.mocked(syncMatchEventStream)
      .mockRejectedValueOnce(new Error('pred.gg timeout'))
      .mockResolvedValueOnce(undefined);
    const db = {
      match: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'match-1', predggUuid: 'uuid-1', rosterSynced: true, eventStreamSynced: false, eventStreamFailed: false },
          { id: 'match-2', predggUuid: 'uuid-2', rosterSynced: true, eventStreamSynced: false, eventStreamFailed: false },
        ]),
        findUnique: vi.fn().mockResolvedValue({ rosterSynced: true, eventStreamSynced: true }),
      },
      syncLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const result = await enrichPlayerMatches(db as never, 'player-1', 'token', { concurrency: 1, userName: 'Player One' });

    expect(result).toEqual({ total: 2, processed: 2, succeeded: 1, errors: 1 });
    expect(syncMatchEventStream).toHaveBeenCalledTimes(2);
    expect(db.syncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'player-enrichment',
        entityId: 'uuid-1',
        status: 'error',
        userName: 'Player One',
      }),
    });
  });
});
