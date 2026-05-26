/**
 * @fileoverview Platform-admin authorization middleware.
 *
 * Restricts a route to users with globalRole "PLATFORM_ADMIN" or "SUPER_ADMIN".
 * Must be used after `requireAuth` so that `req.user` is populated.
 *
 * Used on all /admin/* routes via `adminRouter.use(requireAuth, requirePlatformAdmin)`.
 *
 * Usage:
 * ```ts
 * router.get('/admin/users', requireAuth, requirePlatformAdmin, handler);
 * ```
 */

import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware that allows only PLATFORM_ADMIN and SUPER_ADMIN users.
 * Returns 401 if not authenticated, 403 if the role is insufficient.
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
    return;
  }

  const isAdmin = user.globalRole === 'PLATFORM_ADMIN' || user.globalRole === 'SUPER_ADMIN';
  if (!isAdmin) {
    res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
    return;
  }

  next();
}
