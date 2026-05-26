/**
 * @fileoverview Authentication middleware for internal RiftLine sessions.
 *
 * RiftLine uses its own JWT-based session system (separate from pred.gg OAuth).
 * After login, a signed JWT is stored in an httpOnly cookie (`ps_session`).
 * This middleware validates that cookie on each protected request and attaches
 * the decoded user payload to `req.user`.
 *
 * The JWT is signed with PS_JWT_SECRET (env var). Tokens expire in 1 hour;
 * refresh tokens (30 days) are handled separately in auth.ts.
 *
 * Usage: `router.get('/protected', requireAuth, handler)`
 * Access user in handler: `req.user.userId`, `req.user.globalRole`, etc.
 */

import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { logger } from '../logger.js';

/**
 * Shape of the user payload stored in the JWT and attached to `req.user`.
 * Populated by the login endpoint in internal-auth.ts.
 */
export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  /** "SUPER_ADMIN" | "PLATFORM_ADMIN" | "VIEWER" */
  globalRole: string;
  /** All team memberships for this user — used by requireRole middleware */
  memberships: Array<{ teamId: string; role: string; playerId: string | null }>;
};

/** Name of the httpOnly cookie that carries the session JWT */
const SESSION_COOKIE = 'ps_session';

/** Returns the JWT signing secret as a Uint8Array for use with jose */
function sessionSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.PS_JWT_SECRET ?? '');
}

/**
 * Type guard — ensures the JWT payload has all required SessionUser fields.
 * Guards against malformed tokens or schema changes.
 */
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

/**
 * Express middleware that enforces authentication via the internal session cookie.
 * Attaches the decoded `SessionUser` to `req.user` on success.
 * Returns 401 if the cookie is missing, expired or has an invalid signature.
 */
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
