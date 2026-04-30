import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth.js';

vi.hoisted(() => {
  process.env.PRED_GG_CLIENT_ID = 'test-client-id';
  process.env.PRED_GG_CLIENT_SECRET = 'test-client-secret';
  process.env.PRED_GG_CLIENT_AUTH_METHOD = 'basic';
  process.env.PRED_GG_CALLBACK_URL = 'http://localhost:3001/auth/callback';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  delete process.env.PRED_GG_AUTHORIZE_URL;
  delete process.env.PRED_GG_OAUTH_SCOPES;
});

const app = express();
app.use(cookieParser());
app.use('/auth', authRouter);

describe('GET /auth/predgg', () => {
  it('redirects to the pred.gg OAuth SPA authorize route with PKCE', async () => {
    const res = await request(app).get('/auth/predgg');

    expect(res.status).toBe(302);
    expect(res.headers['x-predgg-auth-flow']).toBe('oauth2-pkce-v2');
    expect(res.headers['x-predgg-token-client-auth']).toBe('basic');

    const location = res.headers.location;
    expect(location).toBeDefined();

    const url = new URL(location);
    expect(url.origin).toBe('https://pred.gg');
    expect(url.pathname).toBe('/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3001/auth/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(
      'offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read',
    );
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('predgg_state='))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('predgg_code_verifier='))).toBe(true);
  });

  it('exchanges callback codes with the stored PKCE verifier', async () => {
    let tokenBody = '';
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      tokenBody = String(init?.body ?? '');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 1800,
          scope: 'offline_access profile player:read:interval',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const login = await request(app).get('/auth/predgg');
    const location = new URL(login.headers.location);
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const callback = await request(app)
      .get(`/auth/callback?code=test-code&state=${location.searchParams.get('state')}`)
      .set('Cookie', cookies);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:5173/players');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pred.gg/api/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
    const tokenHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(tokenHeaders.Origin).toBeUndefined();
    expect(tokenHeaders.Referer).toBeUndefined();
    expect(tokenBody).toContain('grant_type=authorization_code');
    expect(tokenBody).toContain('code=test-code');
    expect(tokenBody).toContain('code_verifier=');
    expect(tokenBody).not.toContain('client_id=');
    expect(tokenBody).not.toContain('client_secret=');
  });

  it('tries alternate token auth shapes when pred.gg rejects the first request as invalid_request', async () => {
    const tokenBodies: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      tokenBodies.push(String(init?.body ?? ''));
      if (tokenBodies.length === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'invalid_request' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 1800,
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const login = await request(app).get('/auth/predgg');
    const location = new URL(login.headers.location);
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const callback = await request(app)
      .get(`/auth/callback?code=test-code&state=${location.searchParams.get('state')}`)
      .set('Cookie', cookies);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:5173/players');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenBodies[0]).not.toContain('client_id=');
    expect(tokenBodies[1]).not.toContain('client_id=');
    const retryHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(retryHeaders.Origin).toBe('http://localhost:5173');
  });
});
