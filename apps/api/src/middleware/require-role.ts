/**
 * @fileoverview Team-role authorization middleware.
 *
 * Checks that the authenticated user has one of the specified roles
 * within the team referenced by the request (teamId from params, body or query).
 *
 * PLATFORM_ADMIN always bypasses the check — they have access to all teams.
 * SUPER_ADMIN is handled upstream by requirePlatformAdmin or global guards.
 *
 * Usage:
 * ```ts
 * router.post('/:teamId/goals', requireAuth, requireRole(['MANAGER', 'COACH']), handler);
 * ```
 *
 * teamId resolution order: req.params.teamId → req.body.teamId → req.query.teamId
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Returns an Express middleware that enforces team-role authorization.
 *
 * @param roles - Allowed team roles (e.g. `['MANAGER', 'COACH']`)
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    // PLATFORM_ADMIN bypasses all team-level role checks
    if (user.globalRole === 'PLATFORM_ADMIN' || user.globalRole === 'SUPER_ADMIN') {
      next();
      return;
    }

    // Resolve teamId from the request — supports params, body and query
    const teamId = req.params.teamId ?? req.body?.teamId ?? req.query.teamId;
    const membership = user.memberships.find((m) => m.teamId === teamId);
    if (!membership || !roles.includes(membership.role)) {
      res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
      return;
    }

    next();
  };
}
