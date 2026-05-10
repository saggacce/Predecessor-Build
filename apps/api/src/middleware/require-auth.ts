import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { logger } from '../logger.js';

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  globalRole: string;
  memberships: Array<{ teamId: string; role: string; playerId: string | null }>;
};

const SESSION_COOKIE = 'ps_session';

function sessionSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.PS_JWT_SECRET ?? '');
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<SessionUser>;
  return (
    typeof user.userId === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.globalRole === 'string' &&
    Array.isArray(user.memberships)
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!isSessionUser(payload)) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      globalRole: payload.globalRole,
      memberships: payload.memberships,
    };
    next();
  } catch (err) {
    logger.warn({ err }, 'internal auth session verification failed');
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
  }
}
