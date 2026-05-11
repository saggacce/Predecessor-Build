import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

vi.mock('../db.js', () => ({
  db: {
    syncLog: { findMany: vi.fn().mockResolvedValue([]) },
    version: { upsert: vi.fn().mockResolvedValue({}) },
    player: { findMany: vi.fn().mockResolvedValue([]) },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

// Mock sync-service so no real HTTP calls to pred.gg are made
vi.mock('../services/sync-service.js', () => ({
  syncVersionsFromPredgg: vi.fn().mockResolvedValue(5),
  syncStalePlayers: vi.fn().mockResolvedValue({ synced: 2, skipped: 0, errors: 0 }),
  syncIncompleteMatches: vi.fn().mockResolvedValue({ synced: 1, errors: 0 }),
  repairEventStreamPlayerIds: vi.fn().mockResolvedValue({
    heroKillsUpdated: 1,
    objectiveKillsUpdated: 1,
    wardEventsUpdated: 1,
    placeholdersCreated: 0,
  }),
  syncPlayerByName: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
});

describe('POST /admin/sync-versions', () => {
  it('returns 200 with sync result', async () => {
    const res = await request(app).post('/admin/sync-versions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('synced', 5);
    expect(res.body).toHaveProperty('elapsed');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('returns 401 when ADMIN_API_KEY is set and header is missing', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    const res = await request(app).post('/admin/sync-versions');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ADMIN_KEY_REQUIRED');
  });

  it('accepts correct X-Admin-Key header', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    const res = await request(app)
      .post('/admin/sync-versions')
      .set('X-Admin-Key', 'secret-key');
    expect(res.status).toBe(200);
  });
});

describe('POST /admin/sync-stale', () => {
  it('returns 200 with sync result including synced/skipped/errors', async () => {
    const res = await request(app).post('/admin/sync-stale');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ synced: 2, skipped: 0, errors: 0 });
    expect(res.body).toHaveProperty('elapsed');
  });

  it('returns 401 when ADMIN_API_KEY is set and header is missing', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    const res = await request(app).post('/admin/sync-stale');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ADMIN_KEY_REQUIRED');
  });
});

describe('POST /admin/fix-herokill-player-ids', () => {
  it('returns 200 with repair counts', async () => {
    const res = await request(app).post('/admin/fix-herokill-player-ids');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      heroKillsUpdated: 1,
      objectiveKillsUpdated: 1,
      wardEventsUpdated: 1,
      placeholdersCreated: 0,
    });
    expect(res.body).toHaveProperty('elapsed');
  });

  it('returns 401 when ADMIN_API_KEY is set and header is missing', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';

    const res = await request(app).post('/admin/fix-herokill-player-ids');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ADMIN_KEY_REQUIRED');
  });
});

describe('GET /admin/sync-logs', () => {
  it('returns 200 with logs array', async () => {
    const res = await request(app).get('/admin/sync-logs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('returns 400 VALIDATION_ERROR when limit is not a number', async () => {
    const res = await request(app).get('/admin/sync-logs?limit=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when limit exceeds maximum', async () => {
    const res = await request(app).get('/admin/sync-logs?limit=9999');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts entity and status filters', async () => {
    const res = await request(app).get('/admin/sync-logs?entity=player&status=ok');
    expect(res.status).toBe(200);
  });

  it('returns 400 when status filter is invalid', async () => {
    const res = await request(app).get('/admin/sync-logs?status=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
