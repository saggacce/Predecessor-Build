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
}));

import { getPlatformAccessToken } from './predgg-token-service.js';

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
});
