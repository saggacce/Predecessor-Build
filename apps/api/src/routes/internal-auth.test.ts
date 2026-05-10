import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { internalAuthRouter } from './internal-auth.js';
import { errorHandler } from '../middleware/error-handler.js';

vi.hoisted(() => {
  process.env.PS_JWT_SECRET = 'test-secret-for-internal-auth-tests-that-is-long-enough';
  process.env.PS_JWT_EXPIRES_IN = '7d';
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

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.user.findUnique.mockResolvedValue(null);
  mockDb.user.update.mockResolvedValue(userRecord());
  mockDb.invitation.findUnique.mockResolvedValue(null);
  mockDb.__tx.user.create.mockResolvedValue(userRecord({
    id: 'new-user-1',
    email: 'new@example.com',
    name: 'New User',
    memberships: undefined,
  }));
  mockDb.__tx.teamMembership.create.mockResolvedValue({ teamId: 'team-1', role: 'COACH', playerId: null });
  mockDb.__tx.invitation.update.mockResolvedValue(invitationRecord({ usedAt: new Date() }));
});

describe('POST /internal-auth/login', () => {
  it('returns 200 and a session cookie with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const res = await request(app)
      .post('/internal-auth/login')
      .send({ email: 'coach@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('coach@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('ps_session='))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('SameSite=Lax'))).toBe(true);
  });

  it('returns 401 with an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const res = await request(app)
      .post('/internal-auth/login')
      .send({ email: 'coach@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 when the user is inactive', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash, isActive: false }));

    const res = await request(app)
      .post('/internal-auth/login')
      .send({ email: 'coach@example.com', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_INACTIVE');
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

describe('GET /internal-auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/internal-auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 200 with a valid cookie', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    mockDb.user.findUnique.mockResolvedValue(userRecord({ passwordHash }));

    const login = await request(app)
      .post('/internal-auth/login')
      .send({ email: 'coach@example.com', password: 'correct-password' });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const res = await request(app).get('/internal-auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.memberships).toEqual([{ teamId: 'team-1', role: 'MANAGER', playerId: null }]);
  });
});
