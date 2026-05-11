import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { authCookie } from '../test/auth-cookie.js';

vi.mock('../db.js', () => ({
  db: {
    team: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    teamRoster: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../db.js';
const mockTeam = (db as any).team as {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const mockPlayer = (db as any).player as { findUnique: ReturnType<typeof vi.fn> };
const mockTeamRoster = (db as any).teamRoster as {
  findFirst: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

let managerCookie: string;
let playerCookie: string;

function teamRecord(overrides = {}) {
  return {
    id: 'team-1',
    name: 'Test Team',
    abbreviation: 'TT',
    logoUrl: 'https://example.com/logo.png',
    type: 'OWN',
    region: 'EU',
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    roster: [],
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  managerCookie = await authCookie();
  playerCookie = await authCookie({
    memberships: [{ teamId: 'team-1', role: 'JUGADOR', playerId: 'player-1' }],
  });
  mockTeam.findMany.mockResolvedValue([]);
  mockTeam.findUnique.mockResolvedValue(null);
  mockTeam.create.mockResolvedValue(teamRecord());
  mockTeam.update.mockResolvedValue(teamRecord());
  mockTeam.delete.mockResolvedValue(teamRecord());
  mockPlayer.findUnique.mockResolvedValue({ id: 'player-1' });
  mockTeamRoster.findFirst.mockResolvedValue(null);
  mockTeamRoster.findUnique.mockResolvedValue(null);
  mockTeamRoster.create.mockResolvedValue({ id: 'roster-1' });
  mockTeamRoster.update.mockResolvedValue({ id: 'roster-1' });
  mockTeamRoster.deleteMany.mockResolvedValue({ count: 0 });
});

describe('GET /teams', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/teams');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 200 with teams array', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams').set('Cookie', managerCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.teams)).toBe(true);
  });

  it('returns 400 VALIDATION_ERROR when type is invalid', async () => {
    const res = await request(app).get('/teams?type=INVALID').set('Cookie', managerCookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts type=OWN filter', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams?type=OWN').set('Cookie', managerCookie);
    expect(res.status).toBe(200);
  });

  it('accepts type=RIVAL filter', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams?type=RIVAL').set('Cookie', managerCookie);
    expect(res.status).toBe(200);
  });
});

describe('GET /teams/:id', () => {
  it('returns 404 TEAM_NOT_FOUND when team does not exist', async () => {
    mockTeam.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/teams/nonexistent-id').set('Cookie', managerCookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
  });
});

describe('POST /teams', () => {
  it('returns 403 for non-manager users', async () => {
    const res = await request(app)
      .post('/teams')
      .set('Cookie', playerCookie)
      .send({ name: 'Test Team', type: 'OWN' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('creates a team and returns its profile', async () => {
    mockTeam.findUnique.mockResolvedValue(teamRecord());
    const res = await request(app)
      .post('/teams')
      .set('Cookie', managerCookie)
      .send({ name: 'Test Team', abbreviation: 'TT', logoUrl: 'https://example.com/logo.png', type: 'OWN', region: 'EU' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('team-1');
    expect(res.body.aggregateStats).toEqual({ totalMatches: 0, averageKDA: 0 });
    expect(mockTeam.create).toHaveBeenCalledWith({
      data: { name: 'Test Team', abbreviation: 'TT', logoUrl: 'https://example.com/logo.png', type: 'OWN', region: 'EU' },
    });
  });

  it('returns 400 VALIDATION_ERROR when type is missing', async () => {
    const res = await request(app).post('/teams').set('Cookie', managerCookie).send({ name: 'Test Team' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /teams/:id', () => {
  it('updates a team and returns its profile', async () => {
    mockTeam.findUnique
      .mockResolvedValueOnce(teamRecord())
      .mockResolvedValueOnce(teamRecord({ name: 'Renamed' }));

    const res = await request(app)
      .patch('/teams/team-1')
      .set('Cookie', managerCookie)
      .send({ name: 'Renamed', logoUrl: null, notes: null });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(mockTeam.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { name: 'Renamed', logoUrl: null, notes: null },
    });
  });
});

describe('DELETE /teams/:id', () => {
  it('deletes roster entries before deleting the team', async () => {
    mockTeam.findUnique.mockResolvedValue(teamRecord());

    const res = await request(app).delete('/teams/team-1').set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockTeamRoster.deleteMany).toHaveBeenCalledWith({ where: { teamId: 'team-1' } });
    expect(mockTeam.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
  });
});

describe('POST /teams/:id/roster', () => {
  it('adds a player to the active roster', async () => {
    mockTeam.findUnique.mockResolvedValue(teamRecord());
    mockPlayer.findUnique.mockResolvedValue({ id: 'player-1' });

    const res = await request(app)
      .post('/teams/team-1/roster')
      .set('Cookie', managerCookie)
      .send({ playerId: 'player-1', role: 'jungle' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('roster-1');
    expect(mockTeamRoster.create).toHaveBeenCalledWith({
      data: { teamId: 'team-1', playerId: 'player-1', role: 'jungle' },
    });
  });

  it('returns 409 when the player is already active in the roster', async () => {
    mockTeam.findUnique.mockResolvedValue(teamRecord());
    mockPlayer.findUnique.mockResolvedValue({ id: 'player-1' });
    mockTeamRoster.findFirst.mockResolvedValue({ id: 'roster-1' });

    const res = await request(app)
      .post('/teams/team-1/roster')
      .set('Cookie', managerCookie)
      .send({ playerId: 'player-1' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_IN_ROSTER');
  });
});

describe('PATCH /teams/:id/roster/:rosterId', () => {
  it('updates a roster role when the entry belongs to the team', async () => {
    mockTeamRoster.findUnique.mockResolvedValue({ id: 'roster-1', teamId: 'team-1' });

    const res = await request(app)
      .patch('/teams/team-1/roster/roster-1')
      .set('Cookie', managerCookie)
      .send({ role: 'support' });

    expect(res.status).toBe(200);
    expect(mockTeamRoster.update).toHaveBeenCalledWith({
      where: { id: 'roster-1' },
      data: { role: 'support' },
    });
  });

  it('does not update a roster entry from another team', async () => {
    mockTeamRoster.findUnique.mockResolvedValue({ id: 'roster-1', teamId: 'other-team' });

    const res = await request(app)
      .patch('/teams/team-1/roster/roster-1')
      .set('Cookie', managerCookie)
      .send({ role: 'support' });

    expect(res.status).toBe(404);
    expect(mockTeamRoster.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /teams/:id/roster/:rosterId', () => {
  it('soft-removes a roster player when the entry belongs to the team', async () => {
    mockTeamRoster.findUnique.mockResolvedValue({ id: 'roster-1', teamId: 'team-1' });

    const res = await request(app).delete('/teams/team-1/roster/roster-1').set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockTeamRoster.update).toHaveBeenCalledWith({
      where: { id: 'roster-1' },
      data: { activeTo: expect.any(Date) },
    });
  });
});
