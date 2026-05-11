import { SignJWT } from 'jose';
import type { SessionUser } from '../middleware/require-auth.js';

export const TEST_JWT_SECRET = 'test-secret-for-route-auth-tests-1234567890';

export function testSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    globalRole: 'VIEWER',
    memberships: [{ teamId: 'team-1', role: 'MANAGER', playerId: null }],
    ...overrides,
  };
}

export async function authCookie(overrides: Partial<SessionUser> = {}): Promise<string> {
  process.env.PS_JWT_SECRET = TEST_JWT_SECRET;
  const user = testSessionUser(overrides);
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET));

  return `ps_session=${token}`;
}
