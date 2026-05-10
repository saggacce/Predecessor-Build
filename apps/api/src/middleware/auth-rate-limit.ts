import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

function authRateLimitKey(req: Request): string {
  const testKey = req.get('x-test-rate-limit-key');
  if (process.env.NODE_ENV === 'test' && testKey) {
    return `test:${testKey}`;
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: authRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, try again later', code: 'RATE_LIMITED' } },
  skipSuccessfulRequests: true,
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: authRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many registration attempts', code: 'RATE_LIMITED' } },
});
