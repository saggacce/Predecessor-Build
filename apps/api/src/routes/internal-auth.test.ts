import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { internalAuthRouter } from './internal-auth.js';
import { errorHandler } from '../middleware/error-handler.js';
import { loginRateLimit, registerRateLimit } from '../middleware/auth-rate-limit.js';

vi.hoisted(() => {
  process.env.PS_JWT_SECRET = 'test-secret-for-internal-auth-tests-that-is-long-enough';
  process.env.PS_JWT_EXPIRES_IN = '1h';
});

vi.mock('../db.js', () => {
  const tx = {
    user: { create: vi.fn() },
    teamMembership: { create: vi.fn() },
    invitation: { update: vi.fn() },
  };

  return {
    db: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      invitation: {
        findUnique: vi.fn(),
      },
      syncLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
      __tx: tx,
    },
    disconnectDb: vi.fn().mockResolvedValue(undefined),
  };
});

import { db } from '../db.js';

const mockDb = db as any;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/internal-auth', internalAuthRouter);
app.use(errorHandler);

function loginRequest(rateLimitKey: string) {
  return request(app).post('/internal-auth/login').set('x-test-rate-limit-key', rateLimitKey);
}

function userRecord(overrides = {}) {
  return {
    id: 'user-1',
    email: 'coach@example.com',
    name: 'Coach',
    passwordHash: '$2a$12$hash',
    globalRole: 'VIEWER',
    isActive: true,
    memberships: [{ teamId: 'team-1', role: 'MANAGER', playerId: null }],
    ...overrides,
  };
}

function invitationRecord(overrides = {}) {
  return {
    id: 'invitation-1',
    token: 'invite-token',
    email: 'new@example.com',
    teamId: 'team-1',
    role: 'COACH',
    invitedById: 'manager-1',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockDb.user.findUnique.mockResolvedValue(null);
  mockDb.user.update.mockResolvedValue(userRecord());
  mockDb.invitation.findUnique.mockResolvedValue(null);
  mockDb.syncLog.create.mockResolvedValue({ id: 'sync-log-1' });
  mockDb.__tx.user.create.mockResolvedValue(userRecord({
    id: 'new-user-1',
    email: 'new@example.com',
    name: 'New User',
    memberships: undefined,
  }));
  mockDb.__tx.teamMembership.create.mockResolvedValue({ teamId: 'team-1', role: 'COACH', playerId: null });
  mockDb.__tx.invitation.update.mockResolvedValue(invitationRecord({ usedAt: new Date() }));
  await loginRateLimit.resetKey('::ffff:127.0.0.1');
  await loginRateLimit.resetKey('::1');
  await registerRateLimit.resetKey('::ffff:127.0.0.1');
  await registerRateLimit.resetKey('::1');
});

describe('POST /internal-auth/login', () => {
  it('returns 200 and a session cookie with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const res = await loginRequest('login-success')
      .send({ email: 'coach@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('coach@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('ps_session='))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('ps_refresh='))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('SameSite=Lax'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('ps_refresh=') && cookie.includes('Path=/internal-auth/refresh'))).toBe(true);
    expect(mockDb.syncLog.create).toHaveBeenCalledWith({
      data: { entity: 'User', entityId: 'user-1', operation: 'login', status: 'success' },
    });
  });

  it('returns 401 with an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const res = await loginRequest('login-wrong-password')
      .send({ email: 'coach@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 when the user is inactive', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash, isActive: false }));

    const res = await loginRequest('login-inactive')
      .send({ email: 'coach@example.com', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_INACTIVE');
  });

  it('runs bcrypt even when the email does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const compareSpy = vi.spyOn(bcrypt, 'compare');

    const res = await loginRequest('login-missing-user')
      .send({ email: 'missing@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy.mock.calls[0][1]).toMatch(/^\$2b\$12\$/);
  });

  it('blocks login after 10 failed attempts', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    for (let attempt = 0; attempt < 10; attempt++) {
      const res = await loginRequest('login-rate-limited')
        .send({ email: 'ratelimit@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const res = await loginRequest('login-rate-limited')
      .send({ email: 'ratelimit@example.com', password: 'wrong-password' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('sets secure cookies in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    try {
      const res = await loginRequest('login-secure-production')
        .send({ email: 'coach@example.com', password: 'correct-password' });

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(res.status).toBe(200);
      expect(cookies.find((cookie) => cookie.startsWith('ps_session='))).toContain('Secure');
      expect(cookies.find((cookie) => cookie.startsWith('ps_refresh='))).toContain('Secure');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe('POST /internal-auth/register', () => {
  it('returns 201, sets a cookie, and creates a TeamMembership for a valid token', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(invitationRecord());

    const res = await request(app)
      .post('/internal-auth/register')
      .send({ token: 'invite-token', name: 'New User', password: 'new-password' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(mockDb.__tx.teamMembership.create).toHaveBeenCalledWith({
      data: { userId: 'new-user-1', teamId: 'team-1', role: 'COACH' },
      select: { teamId: true, role: true, playerId: true },
    });
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('ps_session='))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('ps_refresh='))).toBe(true);
    expect(mockDb.syncLog.create).toHaveBeenCalledWith({
      data: { entity: 'User', entityId: 'new-user-1', operation: 'register', status: 'success' },
    });
  });

  it('returns 400 with an expired token', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(invitationRecord({
      expiresAt: new Date(Date.now() - 60_000),
    }));

    const res = await request(app)
      .post('/internal-auth/register')
      .send({ token: 'invite-token', name: 'New User', password: 'new-password' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVITATION_EXPIRED');
  });

  it('returns 400 with an already used token', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(invitationRecord({ usedAt: new Date() }));

    const res = await request(app)
      .post('/internal-auth/register')
      .send({ token: 'invite-token', name: 'New User', password: 'new-password' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVITATION_USED');
  });
});

describe('POST /internal-auth/refresh', () => {
  it('rotates a session from a valid refresh token', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const login = await loginRequest('refresh-rotate-login')
      .send({ email: 'coach@example.com', password: 'correct-password' });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('ps_refresh='));

    mockDb.user.findUnique.mockResolvedValue(userRecord());
    const res = await request(app).post('/internal-auth/refresh').set('Cookie', refreshCookie!);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const rotatedCookies = res.headers['set-cookie'] as unknown as string[];
    expect(rotatedCookies.some((cookie) => cookie.startsWith('ps_session='))).toBe(true);
    expect(rotatedCookies.some((cookie) => cookie.startsWith('ps_refresh='))).toBe(true);

    const sessionCookie = rotatedCookies.find((cookie) => cookie.startsWith('ps_session='))!;
    const sessionToken = sessionCookie.split(';')[0].replace('ps_session=', '');
    const { payload } = await jwtVerify(sessionToken, new TextEncoder().encode(process.env.PS_JWT_SECRET));
    expect(payload.userId).toBe('user-1');
  });

  it('rejects refresh for an inactive user', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const login = await loginRequest('refresh-inactive-login')
      .send({ email: 'coach@example.com', password: 'correct-password' });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('ps_refresh='));

    mockDb.user.findUnique.mockResolvedValue(userRecord({ isActive: false }));
    const res = await request(app).post('/internal-auth/refresh').set('Cookie', refreshCookie!);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });
});

describe('GET /internal-auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/internal-auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 200 with a valid cookie', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const login = await loginRequest('me-valid-cookie-login')
      .send({ email: 'coach@example.com', password: 'correct-password' });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const res = await request(app).get('/internal-auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.memberships).toEqual([{ teamId: 'team-1', role: 'MANAGER', playerId: null }]);
  });
});
