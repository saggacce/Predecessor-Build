import type { NextFunction, Request, Response } from 'express';

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
    return;
  }

  if (user.globalRole !== 'PLATFORM_ADMIN') {
    res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
    return;
  }

  next();
}
