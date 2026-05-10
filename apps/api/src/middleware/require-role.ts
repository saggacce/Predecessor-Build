import type { NextFunction, Request, Response } from 'express';

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    if (user.globalRole === 'PLATFORM_ADMIN') {
      next();
      return;
    }

    const teamId = req.params.teamId ?? req.body?.teamId ?? req.query.teamId;
    const membership = user.memberships.find((m) => m.teamId === teamId);
    if (!membership || !roles.includes(membership.role)) {
      res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
      return;
    }

    next();
  };
}
