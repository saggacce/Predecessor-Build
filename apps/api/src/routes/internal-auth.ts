import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { loginRateLimit, registerRateLimit } from '../middleware/auth-rate-limit.js';
import { requireAuth, type SessionUser } from '../middleware/require-auth.js';
import { logger } from '../logger.js';

export const internalAuthRouter = Router();

const SESSION_COOKIE = 'ps_session';
const REFRESH_COOKIE = 'ps_refresh';
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$nEepa.avChnIhNhaFuuTl.atEouSMEYqQZWLGAT5u9wRUou6CY1DS';

const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

const registerSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

type UserWithMemberships = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  memberships: Array<{ teamId: string; role: string; playerId: string | null }>;
};

function jwtSecret(): Uint8Array {
  const secret = process.env.PS_JWT_SECRET;
  if (!secret) {
    throw new AppError(500, 'Internal auth is not configured', 'INTERNAL_AUTH_NOT_CONFIGURED');
  }
  return new TextEncoder().encode(secret);
}

function toSessionUser(user: UserWithMemberships): SessionUser {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
    linkedPlayerId: user.linkedPlayerId ?? null,
    avatarUrl: user.avatarUrl ?? null,
    memberships: user.memberships.map((membership) => ({
      teamId: membership.teamId,
      role: membership.role,
      playerId: membership.playerId,
    })),
  };
}

function toResponseUser(user: UserWithMemberships) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
    linkedPlayerId: user.linkedPlayerId ?? null,
    avatarUrl: user.avatarUrl ?? null,
    memberships: user.memberships.map((membership) => ({
      teamId: membership.teamId,
      role: membership.role,
      playerId: membership.playerId,
    })),
  };
}

async function signSession(user: UserWithMemberships): Promise<string> {
  return new SignJWT({ ...toSessionUser(user) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.PS_JWT_EXPIRES_IN ?? '1h')
    .sign(jwtSecret());
}

async function setSessionCookie(res: Response, user: UserWithMemberships): Promise<void> {
  const token = await signSession(user);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
  });

  const refreshToken = await new SignJWT({ userId: user.id, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(jwtSecret());
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/internal-auth/refresh',
  });
}

internalAuthRouter.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: { select: { teamId: true, role: true, playerId: true } },

      },
    });

    const passwordValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !passwordValid) {
      logger.warn({ email }, 'internal auth login failed');
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      logger.warn({ userId: user.id }, 'inactive internal user attempted login');
      throw new AppError(403, 'User is inactive', 'USER_INACTIVE');
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(res, user);
    await db.syncLog.create({
      data: { entity: 'User', entityId: user.id, operation: 'login', status: 'success' },
    });
    logger.info({ userId: user.id }, 'internal auth login succeeded');
    res.json({ user: toResponseUser(user) });
  } catch (err) {
    next(err);
  }
});

internalAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.clearCookie(REFRESH_COOKIE, { path: '/internal-auth/refresh' });
  res.json({ ok: true });
});

internalAuthRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new AppError(401, 'Not authenticated', 'NOT_AUTHENTICATED');
    }

    const { payload } = await jwtVerify(refreshToken, jwtSecret());
    if (payload.type !== 'refresh' || typeof payload.userId !== 'string') {
      throw new AppError(401, 'Invalid refresh token', 'INVALID_TOKEN');
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: {
        memberships: { select: { teamId: true, role: true, playerId: true } },

      },
    });
    if (!user || !user.isActive) {
      throw new AppError(401, 'Not authenticated', 'NOT_AUTHENTICATED');
    }

    await setSessionCookie(res, user);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

internalAuthRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    // Fetch fields not stored in JWT from DB
    const dbUser = await db.user.findUnique({
      where: { id: user.userId },
      select: { linkedPlayerId: true, avatarUrl: true },
    });
    res.json({
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        linkedPlayerId: dbUser?.linkedPlayerId ?? null,
        avatarUrl: dbUser?.avatarUrl ?? null,
        memberships: user.memberships,
      },
    });
  } catch (err) { next(err); }
});

internalAuthRouter.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { token, name, password } = registerSchema.parse(req.body);
    const invitation = await db.invitation.findUnique({ where: { token } });

    if (!invitation) {
      throw new AppError(400, 'Invalid invitation', 'INVALID_INVITATION');
    }
    if (invitation.usedAt) {
      throw new AppError(400, 'Invitation already used', 'INVITATION_USED');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new AppError(400, 'Invitation expired', 'INVITATION_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          name,
          passwordHash,
        },
      });
      const membership = await tx.teamMembership.create({
        data: {
          userId: createdUser.id,
          teamId: invitation.teamId,
          role: invitation.role,
          playerId: invitation.playerId ?? null,
        },
        select: { teamId: true, role: true, playerId: true },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      return { ...createdUser, memberships: [membership] };
    });

    await setSessionCookie(res, user);
    await db.syncLog.create({
      data: { entity: 'User', entityId: user.id, operation: 'register', status: 'success' },
    });
    logger.info({ userId: user.id, invitationId: invitation.id }, 'internal auth registration completed');
    res.status(201).json({ user: toResponseUser(user) });
  } catch (err) {
    next(err);
  }
});
