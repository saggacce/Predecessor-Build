import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

function authRateLimitKey(req: Request): string {
  const testKey = req.get('x-test-rate-limit-key');
  if (process.env.NODE_ENV === 'test' && testKey) {
    return `test:${testKey}`;
  }
  // Use email as secondary key when IP is unavailable (e.g. WSL with no internet)
  // This prevents all users sharing a single 'unknown' bucket
  const ip = req.ip;
  if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'unknown') {
    return ip;
  }
  // Fall back to email-based key for local/offline scenarios
  const email = (req.body as { email?: string })?.email?.toLowerCase();
  return email ? `local:${email}` : `local:${ip ?? 'unknown'}`;
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
