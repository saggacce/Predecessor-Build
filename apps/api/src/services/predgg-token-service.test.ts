import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const credentials = new Map<string, string>();
  const platformCredential = {
    findMany: vi.fn(async ({ where }: any) => {
      const keys = where.key.in as string[];
      return keys.filter((key) => credentials.has(key)).map((key) => ({ key, value: credentials.get(key)! }));
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      const value = credentials.get(where.key);
      return value === undefined ? null : { key: where.key, value };
    }),
    upsert: vi.fn(async ({ where, update, create }: any) => {
      const value = credentials.has(where.key) ? update.value : create.value;
      credentials.set(where.key, value);
      return { key: where.key, value };
    }),
  };
  const transactionClient = {
    platformCredential,
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  };
  return { credentials, platformCredential, transactionClient, exchangeToken: vi.fn() };
});

vi.mock('../db.js', () => ({
  db: {
    platformCredential: mocks.platformCredential,
    $transaction: vi.fn(async (callback: any) => callback(mocks.transactionClient)),
  },
}));

vi.mock('./predgg-oauth.js', () => ({
  exchangeToken: mocks.exchangeToken,
  predggOAuthConfig: {
    scopes: 'offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read',
  },
}));

import { getPlatformAccessToken, inspectPlatformOAuthStatus, savePlatformOAuthTokens } from './predgg-token-service.js';

describe('pred.gg platform token manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credentials.clear();
    mocks.credentials.set('predgg_refresh_token', 'original-refresh-token');
  });

  it('single-flights concurrent refreshes and persists the rotated token atomically', async () => {
    mocks.exchangeToken.mockResolvedValue({
      ok: true,
      status: 200,
      endpoint: 'https://pred.gg/api/oauth2/token',
      attempt: 'client-secret-basic',
      data: {
        access_token: 'new-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 3600,
      },
    });

    const [first, second] = await Promise.all([
      getPlatformAccessToken(),
      getPlatformAccessToken(),
    ]);

    expect(first?.accessToken).toBe('new-access-token');
    expect(second?.accessToken).toBe('new-access-token');
    expect(mocks.exchangeToken).toHaveBeenCalledTimes(1);
    expect(mocks.credentials.get('predgg_refresh_token')).toBe('rotated-refresh-token');

    const cached = await getPlatformAccessToken();
    expect(cached?.accessToken).toBe('new-access-token');
    expect(mocks.exchangeToken).toHaveBeenCalledTimes(1);
  });

  it('persists granted scopes and reports missing capabilities without exposing tokens', async () => {
    await savePlatformOAuthTokens({
      access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600,
      scope: 'profile offline_access',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { currentAuth: { scope: 'profile offline_access' } } }),
    }));

    const status = await inspectPlatformOAuthStatus('access-token');

    expect(status.grantedScopes).toEqual(['offline_access', 'profile']);
    expect(status.missingScopes).toEqual([
      'hero_leaderboard:read', 'matchup_statistic:read', 'player:read:interval',
    ]);
    expect(status.capabilities).toMatchObject({
      profile: true, offlineRefresh: true, playerIntervals: false,
      heroLeaderboard: false, matchupStatistics: false,
    });
    expect(JSON.stringify(status)).not.toContain('access-token');
    expect(mocks.credentials.get('predgg_granted_scopes')).toBe('offline_access profile');
  });
});
