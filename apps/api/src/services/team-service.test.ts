import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTeamDraftAnalysis,
  getTeamObjectiveAnalysis,
  getTeamPhaseAnalysis,
  getTeamVisionAnalysis,
} from './team-service.js';
import { db } from '../db.js';

vi.mock('../db.js', () => ({
  db: {
    team: { findUnique: vi.fn() },
    teamRoster: { findMany: vi.fn() },
    heroKill: { findMany: vi.fn() },
    objectiveKill: { findMany: vi.fn() },
    structureDestruction: { findMany: vi.fn() },
    wardEvent: { findMany: vi.fn() },
    matchPlayer: { findMany: vi.fn() },
    heroBan: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

const mockDb = db as unknown as {
  team: { findUnique: ReturnType<typeof vi.fn> };
  teamRoster: { findMany: ReturnType<typeof vi.fn> };
  heroKill: { findMany: ReturnType<typeof vi.fn> };
  objectiveKill: { findMany: ReturnType<typeof vi.fn> };
  structureDestruction: { findMany: ReturnType<typeof vi.fn> };
  wardEvent: { findMany: ReturnType<typeof vi.fn> };
  matchPlayer: { findMany: ReturnType<typeof vi.fn> };
  heroBan: { findMany: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};

const roster = ['p1', 'p2', 'p3'].map((playerId) => ({ playerId }));

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.team.findUnique.mockResolvedValue({ id: 'team-1' });
  mockDb.teamRoster.findMany.mockResolvedValue(roster);
  mockDb.$queryRaw.mockReset();
  mockDb.heroKill.findMany.mockResolvedValue([]);
  mockDb.objectiveKill.findMany.mockResolvedValue([]);
  mockDb.structureDestruction.findMany.mockResolvedValue([]);
  mockDb.wardEvent.findMany.mockResolvedValue([]);
  mockDb.matchPlayer.findMany.mockResolvedValue([]);
  mockDb.heroBan.findMany.mockResolvedValue([]);
});

describe('getTeamPhaseAnalysis', () => {
  it('calculates kill/objective diffs, throw rate and comeback rate', async () => {
    mockDb.$queryRaw.mockResolvedValue([
      { matchId: 'm1', predggUuid: 'uuid-1', team: 'BLUE', winningTeam: 'RED' },
      { matchId: 'm2', predggUuid: 'uuid-2', team: 'BLUE', winningTeam: 'BLUE' },
    ]);
    mockDb.heroKill.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 100, killerTeam: 'BLUE' },
      { matchId: 'm1', gameTime: 700, killerTeam: 'RED' },
      { matchId: 'm2', gameTime: 200, killerTeam: 'RED' },
      { matchId: 'm2', gameTime: 800, killerTeam: 'BLUE' },
    ]);
    mockDb.objectiveKill.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 500, killerTeam: 'BLUE', entityType: 'FANGTOOTH' },
      { matchId: 'm2', gameTime: 650, killerTeam: 'RED', entityType: 'FANGTOOTH' },
    ]);

    const result = await getTeamPhaseAnalysis('team-1');

    expect(result.sampleSize).toBe(2);
    expect(result.avgKillDiff10).toBe(0);
    expect(result.avgKillDiff15).toBe(0);
    expect(result.avgObjectiveDiff10).toBe(0.5);
    expect(result.avgObjectiveDiff15).toBe(0);
    expect(result.throwRate).toBe(100);
    expect(result.comebackRate).toBe(100);
  });

  it('returns an empty result when the team has no roster players', async () => {
    mockDb.teamRoster.findMany.mockResolvedValue([]);

    const result = await getTeamPhaseAnalysis('team-1');

    expect(result.sampleSize).toBe(0);
    expect(result.avgKillDiff10).toBeNull();
    expect(result.perMatch).toEqual([]);
  });
});

describe('getTeamVisionAnalysis', () => {
  it('calculates vision score, objective reactions and role alive rates', async () => {
    mockDb.$queryRaw.mockResolvedValue([
      { matchId: 'm1', team: 'BLUE', winningTeam: 'BLUE' },
    ]);
    mockDb.wardEvent.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 140, eventType: 'PLACEMENT', team: 'BLUE', locationX: 0, locationY: 0 },
      { matchId: 'm1', gameTime: 150, eventType: 'PLACEMENT', team: 'BLUE', locationX: 50, locationY: 0 },
      { matchId: 'm1', gameTime: 160, eventType: 'DESTRUCTION', team: 'BLUE', locationX: 100, locationY: 0 },
      { matchId: 'm1', gameTime: 170, eventType: 'DESTRUCTION', team: 'RED', locationX: 100, locationY: 0 },
    ]);
    mockDb.heroKill.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 100, killedTeam: 'BLUE', killedPlayerId: 'p2' },
      { matchId: 'm1', gameTime: 200, killedTeam: 'RED', killedPlayerId: 'enemy-1' },
      { matchId: 'm1', gameTime: 220, killedTeam: 'BLUE', killedPlayerId: 'p1' },
    ]);
    mockDb.objectiveKill.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 180, entityType: 'FANGTOOTH', killerTeam: 'RED', locationX: 0, locationY: 0 },
      { matchId: 'm1', gameTime: 250, entityType: 'SHAPER', killerTeam: 'BLUE', locationX: 0, locationY: 0 },
      { matchId: 'm1', gameTime: 260, entityType: 'BLUE_BUFF', killerTeam: 'RED', locationX: 0, locationY: 0 },
    ]);
    mockDb.matchPlayer.findMany.mockResolvedValue([
      { matchId: 'm1', playerId: 'p1', role: 'JUNGLE' },
      { matchId: 'm1', playerId: 'p2', role: 'SUPPORT' },
    ]);

    const result = await getTeamVisionAnalysis('team-1');

    expect(result.sampleSize).toBe(1);
    expect(result.visionControlScore).toBe(2);
    expect(result.objectiveLostAfterAllyDeathRate).toBe(50);
    expect(result.objectiveTakenAfterEnemyDeathRate).toBe(100);
    expect(result.byObjective).toEqual([
      {
        entityType: 'SHAPER',
        teamTaken: 1,
        avgWardsNearby: 2,
        avgWardsLost: 1,
        avgEnemyWardsCleared: 1,
        junglerAliveRate: 0,
        supportAliveRate: 100,
      },
    ]);
  });
});

describe('getTeamObjectiveAnalysis', () => {
  it('calculates conversion windows, timing stdDev and priority share', async () => {
    mockDb.$queryRaw.mockResolvedValue([
      { matchId: 'm1', team: 'BLUE' },
      { matchId: 'm2', team: 'BLUE' },
    ]);
    mockDb.objectiveKill.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 100, entityType: 'FANGTOOTH', killerTeam: 'BLUE' },
      { matchId: 'm1', gameTime: 220, entityType: 'FANGTOOTH', killerTeam: 'BLUE' },
      { matchId: 'm2', gameTime: 1000, entityType: 'ORB_PRIME', killerTeam: 'BLUE' },
      { matchId: 'm2', gameTime: 300, entityType: 'SHAPER', killerTeam: 'RED' },
    ]);
    mockDb.structureDestruction.findMany.mockResolvedValue([
      { matchId: 'm1', gameTime: 150, structureType: 'TOWER', destructionTeam: 'BLUE' },
      { matchId: 'm1', gameTime: 260, structureType: 'INHIBITOR', destructionTeam: 'BLUE' },
      { matchId: 'm2', gameTime: 1190, structureType: 'CORE', destructionTeam: 'BLUE' },
    ]);

    const result = await getTeamObjectiveAnalysis('team-1');

    expect(result.sampleSize).toBe(2);
    expect(result.conversions).toEqual([
      { entityType: 'FANGTOOTH', taken: 2, toAnyStructureRate: 100, toInhibitorRate: 50, toCoreRate: 0 },
      { entityType: 'ORB_PRIME', taken: 1, toAnyStructureRate: 0, toInhibitorRate: 0, toCoreRate: 0 },
    ]);
    expect(result.timingStats).toEqual([
      { entityType: 'FANGTOOTH', teamTaken: 2, avgGameTimeSecs: 160, stdDevSecs: 60, priorityShare: 67 },
      { entityType: 'ORB_PRIME', teamTaken: 1, avgGameTimeSecs: 1000, stdDevSecs: null, priorityShare: 33 },
    ]);
  });
});

describe('getTeamDraftAnalysis', () => {
  it('calculates picks, ranked bans, hero pool depth and overlap', async () => {
    mockDb.$queryRaw.mockResolvedValue([
      { matchId: 'm1', team: 'BLUE', winningTeam: 'BLUE', gameMode: 'RANKED' },
      { matchId: 'm2', team: 'BLUE', winningTeam: 'RED', gameMode: 'CASUAL' },
    ]);
    mockDb.matchPlayer.findMany
      .mockResolvedValueOnce([
        { matchId: 'm1', playerId: 'p1', heroSlug: 'riktor', kills: 3, deaths: 1, assists: 5 },
        { matchId: 'm2', playerId: 'p2', heroSlug: 'riktor', kills: 1, deaths: 2, assists: 3 },
      ])
      .mockResolvedValueOnce([
        { playerId: 'p1', heroSlug: 'riktor', kills: 3, deaths: 1, assists: 5, team: 'BLUE', match: { winningTeam: 'BLUE' } },
        { playerId: 'p1', heroSlug: 'riktor', kills: 4, deaths: 2, assists: 4, team: 'BLUE', match: { winningTeam: 'BLUE' } },
        { playerId: 'p1', heroSlug: 'riktor', kills: 2, deaths: 1, assists: 2, team: 'BLUE', match: { winningTeam: 'RED' } },
        { playerId: 'p2', heroSlug: 'riktor', kills: 5, deaths: 1, assists: 5, team: 'BLUE', match: { winningTeam: 'BLUE' } },
        { playerId: 'p2', heroSlug: 'riktor', kills: 5, deaths: 1, assists: 5, team: 'BLUE', match: { winningTeam: 'BLUE' } },
        { playerId: 'p2', heroSlug: 'riktor', kills: 5, deaths: 1, assists: 5, team: 'BLUE', match: { winningTeam: 'BLUE' } },
      ]);
    mockDb.heroBan.findMany.mockResolvedValue([
      { matchId: 'm1', heroSlug: 'kwang', team: 'BLUE' },
      { matchId: 'm1', heroSlug: 'dekker', team: 'RED' },
    ]);

    const result = await getTeamDraftAnalysis('team-1');

    expect(result.sampleSize).toBe(2);
    expect(result.rankedSampleSize).toBe(1);
    expect(result.pickRates[0]).toMatchObject({ heroSlug: 'riktor', pickCount: 2, pickRate: 100, wins: 1, winRate: 50 });
    expect(result.ownBanRates).toEqual([{ heroSlug: 'kwang', count: 1, rate: 100 }]);
    expect(result.receivedBanRates).toEqual([{ heroSlug: 'dekker', count: 1, rate: 100 }]);
    expect(result.playerDepth.find((p) => p.playerId === 'p1')?.heroCount).toBe(1);
    expect(result.heroOverlap).toEqual([{ heroSlug: 'riktor', playerIds: ['p1', 'p2'] }]);
  });
});
