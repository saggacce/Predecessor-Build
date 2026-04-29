import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

vi.mock('../db.js', () => ({
  db: {
    team: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../db.js';
const mockTeam = (db as any).team as { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };

beforeEach(() => vi.clearAllMocks());

describe('GET /teams', () => {
  it('returns 200 with teams array', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.teams)).toBe(true);
  });

  it('returns 400 VALIDATION_ERROR when type is invalid', async () => {
    const res = await request(app).get('/teams?type=INVALID');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts type=OWN filter', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams?type=OWN');
    expect(res.status).toBe(200);
  });

  it('accepts type=RIVAL filter', async () => {
    mockTeam.findMany.mockResolvedValue([]);
    const res = await request(app).get('/teams?type=RIVAL');
    expect(res.status).toBe(200);
  });
});

describe('GET /teams/:id', () => {
  it('returns 404 TEAM_NOT_FOUND when team does not exist', async () => {
    mockTeam.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/teams/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
  });
});
