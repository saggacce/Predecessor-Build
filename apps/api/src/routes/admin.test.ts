import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock child_process before importing app so promisify wraps the mock
vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: object, cb: (err: null, stdout: string, stderr: string) => void) => {
    cb(null, 'sync completed\n', '');
  }),
}));

vi.mock('../db.js', () => ({
  db: {
    syncLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import app from '../index.js';
import { db } from '../db.js';
const mockSyncLog = (db as any).syncLog as { findMany: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
});

describe('POST /admin/sync-data — validation', () => {
  it('returns 400 VALIDATION_ERROR for unknown command', async () => {
    const res = await request(app).post('/admin/sync-data').send({ command: 'rm-rf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when args contain shell metacharacters', async () => {
    const res = await request(app)
      .post('/admin/sync-data')
      .send({ command: 'sync-player', args: ['; rm -rf /'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/admin/sync-data').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /admin/sync-data — auth guard', () => {
  it('returns 401 when ADMIN_API_KEY is set and X-Admin-Key header is missing', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    const res = await request(app).post('/admin/sync-data').send({ command: 'sync-versions' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ADMIN_KEY_REQUIRED');
  });

  it('returns 401 when X-Admin-Key is wrong', async () => {
    process.env.ADMIN_API_KEY = 'secret-key';
    const res = await request(app)
      .post('/admin/sync-data')
      .set('X-Admin-Key', 'wrong-key')
      .send({ command: 'sync-versions' });
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/sync-logs', () => {
  it('returns 200 with logs array', async () => {
    mockSyncLog.findMany.mockResolvedValue([]);
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
});
