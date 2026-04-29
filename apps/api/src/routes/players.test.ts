import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

vi.mock('../db.js', () => ({
  db: {
    player: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../db.js';
const mockPlayer = (db as any).player as { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };

beforeEach(() => vi.clearAllMocks());

describe('GET /players/search', () => {
  it('returns 400 VALIDATION_ERROR when q is missing', async () => {
    const res = await request(app).get('/players/search');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when limit is not a number', async () => {
    const res = await request(app).get('/players/search?q=test&limit=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when limit exceeds maximum', async () => {
    const res = await request(app).get('/players/search?q=test&limit=999');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with results array', async () => {
    mockPlayer.findMany.mockResolvedValue([
      { id: '1', displayName: 'TestPlayer', isPrivate: false, inferredRegion: null, lastSynced: new Date() },
    ]);
    const res = await request(app).get('/players/search?q=test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results[0].displayName).toBe('TestPlayer');
  });

  it('returns empty array when no players match', async () => {
    mockPlayer.findMany.mockResolvedValue([]);
    const res = await request(app).get('/players/search?q=nomatch');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });
});

describe('GET /players/:id', () => {
  it('returns 404 PLAYER_NOT_FOUND when player does not exist', async () => {
    mockPlayer.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/players/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_NOT_FOUND');
  });
});

describe('POST /players/compare', () => {
  it('returns 400 VALIDATION_ERROR when body is missing', async () => {
    const res = await request(app).post('/players/compare').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when only one player ID provided', async () => {
    const res = await request(app).post('/players/compare').send({ playerIdA: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
