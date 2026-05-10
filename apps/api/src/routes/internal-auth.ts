import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth, type SessionUser } from '../middleware/require-auth.js';
import { logger } from '../logger.js';

export const internalAuthRouter = Router();

const SESSION_COOKIE = 'ps_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

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
    .setExpirationTime(process.env.PS_JWT_EXPIRES_IN ?? '7d')
    .sign(jwtSecret());
}

async function setSessionCookie(res: Response, user: UserWithMemberships): Promise<void> {
  const token = await signSession(user);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

internalAuthRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: { select: { teamId: true, role: true, playerId: true } },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      logger.warn({ email }, 'internal auth login failed');
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      logger.warn({ userId: user.id }, 'inactive internal user attempted login');
      throw new AppError(403, 'User is inactive', 'USER_INACTIVE');
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await setSessionCookie(res, user);
    logger.info({ userId: user.id }, 'internal auth login succeeded');
    res.json({ user: toResponseUser(user) });
  } catch (err) {
    next(err);
  }
});

internalAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

internalAuthRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user!;
  res.json({
    user: {
      id: user.userId,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      memberships: user.memberships,
    },
  });
});

internalAuthRouter.post('/register', async (req, res, next) => {
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
    logger.info({ userId: user.id, invitationId: invitation.id }, 'internal auth registration completed');
    res.status(201).json({ user: toResponseUser(user) });
  } catch (err) {
    next(err);
  }
});
