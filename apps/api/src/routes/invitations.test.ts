import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { SignJWT } from 'jose';
import { invitationsRouter } from './invitations.js';
import { errorHandler } from '../middleware/error-handler.js';
import type { SessionUser } from '../middleware/require-auth.js';

vi.hoisted(() => {
  process.env.PS_JWT_SECRET = 'test-secret-for-invitation-route-tests-that-is-long-enough';
  process.env.PS_JWT_EXPIRES_IN = '7d';
});

vi.mock('../db.js', () => ({
  db: {
    invitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../db.js';

const mockInvitation = (db as any).invitation;
const mockSyncLog = (db as any).syncLog;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/invitations', invitationsRouter);
app.use(errorHandler);

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

async function sessionCookie(user: Partial<SessionUser> = {}) {
  const payload: SessionUser = {
    userId: 'user-1',
    email: 'user@example.com',
    name: 'User',
    globalRole: 'VIEWER',
    memberships: [{ teamId: 'team-1', role: 'MANAGER', playerId: null }],
    ...user,
  };
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(process.env.PS_JWT_SECRET));
  return `ps_session=${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvitation.create.mockResolvedValue(invitationRecord());
  mockInvitation.findUnique.mockResolvedValue(null);
  mockInvitation.findMany.mockResolvedValue([]);
  mockInvitation.delete.mockResolvedValue(invitationRecord());
  mockSyncLog.create.mockResolvedValue({ id: 'sync-log-1' });
});

describe('POST /invitations', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/invitations')
      .send({ email: 'new@example.com', teamId: 'team-1', role: 'COACH' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 403 for a JUGADOR membership', async () => {
    const cookie = await sessionCookie({
      memberships: [{ teamId: 'team-1', role: 'JUGADOR', playerId: 'player-1' }],
    });

    const res = await request(app)
      .post('/invitations')
      .set('Cookie', cookie)
      .send({ email: 'new@example.com', teamId: 'team-1', role: 'COACH' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 201 for a MANAGER membership', async () => {
    const cookie = await sessionCookie();

    const res = await request(app)
      .post('/invitations')
      .set('Cookie', cookie)
      .send({ email: 'new@example.com', teamId: 'team-1', role: 'COACH' });

    expect(res.status).toBe(201);
    expect(res.body.invitation.token).toBe('invite-token');
    expect(mockInvitation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'new@example.com',
        teamId: 'team-1',
        role: 'COACH',
        invitedById: 'user-1',
      }),
    }));
    expect(mockSyncLog.create).toHaveBeenCalledWith({
      data: { entity: 'Invitation', entityId: 'invitation-1', operation: 'create', status: 'success' },
    });
  });
});

describe('GET /invitations/:token', () => {
  it('returns 200 for a valid token', async () => {
    mockInvitation.findUnique.mockResolvedValue(invitationRecord());

    const res = await request(app).get('/invitations/invite-token');

    expect(res.status).toBe(200);
    expect(res.body.invitation).toEqual(expect.objectContaining({
      email: 'new@example.com',
      teamId: 'team-1',
      role: 'COACH',
    }));
  });

  it('returns 410 with INVITATION_EXPIRED for an expired token', async () => {
    mockInvitation.findUnique.mockResolvedValue(invitationRecord({
      expiresAt: new Date(Date.now() - 60_000),
    }));

    const res = await request(app).get('/invitations/invite-token');

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('INVITATION_EXPIRED');
  });
});

describe('DELETE /invitations/:id', () => {
  it('writes an audit log when deleting an unused invitation', async () => {
    const cookie = await sessionCookie();
    mockInvitation.findUnique.mockResolvedValue(invitationRecord());

    const res = await request(app).delete('/invitations/invitation-1').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockInvitation.delete).toHaveBeenCalledWith({ where: { id: 'invitation-1' } });
    expect(mockSyncLog.create).toHaveBeenCalledWith({
      data: { entity: 'Invitation', entityId: 'invitation-1', operation: 'delete', status: 'success' },
    });
  });
});
