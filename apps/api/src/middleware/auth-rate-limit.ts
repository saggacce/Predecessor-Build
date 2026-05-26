/**
 * @fileoverview Rate limiting middleware for authentication endpoints.
 *
 * Applies two independent rate limiters:
 * - `loginRateLimit`: 10 attempts per 15 minutes per IP (failed attempts only)
 * - `registerRateLimit`: 5 attempts per hour per IP
 *
 * Key generation strategy:
 * - In production: uses the client IP address
 * - In WSL/local dev (no real IP): falls back to email-based key to avoid
 *   all users sharing a single "unknown" bucket and hitting each other's limits
 * - In tests: uses an X-Test-Rate-Limit-Key header for deterministic testing
 *
 * Applied in internal-auth.ts on the login and register routes.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Generates the rate limit bucket key for a request.
 * Handles WSL/localhost scenarios where req.ip resolves to loopback addresses.
 */
function authRateLimitKey(req: Request): string {
  // In test environments, allow callers to control which bucket they hit
  const testKey = req.get('x-test-rate-limit-key');
  if (process.env.NODE_ENV === 'test' && testKey) {
    return `test:${testKey}`;
  }

  const ip = req.ip;
  if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'unknown') {
    return ipKeyGenerator(req);
  }

  // WSL/offline fallback: use email so each user has their own bucket.
  // Without this, all local users would share the same rate limit counter.
  const email = (req.body as { email?: string })?.email?.toLowerCase();
  return email ? `local:${email}` : `local:${ip ?? 'unknown'}`;
}

/**
 * Rate limiter for POST /auth/login.
 * Allows 10 failed attempts per 15 minutes per IP.
 * Successful logins are excluded from the count (skipSuccessfulRequests).
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyGenerator: authRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, try again later', code: 'RATE_LIMITED' } },
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for POST /auth/register.
 * Allows 5 registration attempts per hour per IP.
 */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: authRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many registration attempts', code: 'RATE_LIMITED' } },
});
