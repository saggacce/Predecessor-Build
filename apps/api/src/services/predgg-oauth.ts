import { logger } from '../logger.js';

const DEFAULT_AUTHORIZE_URL = 'https://pred.gg/oauth2/authorize';
const DEFAULT_SCOPES = 'offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read';

function resolveAuthorizeUrl(value: string | undefined): string {
  if (!value) return DEFAULT_AUTHORIZE_URL;

  if (value.includes('/api/oauth2/authorize')) {
    logger.warn({ configuredUrl: value }, 'ignoring direct OAuth API authorize URL; using pred.gg SPA authorize route');
    return DEFAULT_AUTHORIZE_URL;
  }

  return value;
}

function resolveScopes(value: string | undefined): string {
  const scopes = (value ?? DEFAULT_SCOPES).trim().split(/\s+/).filter(Boolean);
  return scopes.length > 0 ? scopes.join(' ') : DEFAULT_SCOPES;
}

export type ClientAuthMethod = 'none' | 'body' | 'basic';

function resolveClientAuthMethod(value: string | undefined): ClientAuthMethod {
  if (value === 'none' || value === 'public') return 'none';
  if (value === 'body' || value === 'client_secret_post') return 'body';
  if (value === 'basic' || value === 'client_secret_basic') return 'basic';

  if (value && value !== 'auto') {
    logger.warn({ configuredMethod: value }, 'unknown pred.gg token client auth method; using auto');
  }

  if (process.env.PRED_GG_SEND_CLIENT_SECRET === 'true') return 'body';
  return process.env.PRED_GG_CLIENT_SECRET ? 'basic' : 'none';
}

export const predggOAuthConfig = {
  authorizeUrl: resolveAuthorizeUrl(process.env.PRED_GG_AUTHORIZE_URL),
  tokenUrls: [
    process.env.PRED_GG_TOKEN_URL ?? 'https://pred.gg/api/oauth2/token',
    process.env.PRED_GG_TOKEN_URL_FALLBACK ?? 'https://pred.saibotu.de/api/oauth2/token',
  ].filter((url, index, urls) => url && urls.indexOf(url) === index),
  clientId: process.env.PRED_GG_CLIENT_ID ?? '',
  clientSecret: process.env.PRED_GG_CLIENT_SECRET,
  callbackUrl: process.env.PRED_GG_CALLBACK_URL ?? 'http://localhost:3001/auth/callback',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  scopes: resolveScopes(process.env.PRED_GG_OAUTH_SCOPES),
  clientAuthMethod: resolveClientAuthMethod(process.env.PRED_GG_CLIENT_AUTH_METHOD),
};

export type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
};

export type TokenGrant =
  | { grant_type: 'authorization_code'; code: string; code_verifier: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

type TokenAuthAttempt = {
  label: string;
  method: ClientAuthMethod;
  includeClientId: boolean;
  includeClientSecret: boolean;
  browserLikeHeaders: boolean;
};

function tokenAuthAttempts(): TokenAuthAttempt[] {
  if (predggOAuthConfig.clientAuthMethod === 'none') {
    return [
      { label: 'public-browser', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
      { label: 'public-server', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: false },
    ];
  }

  if (predggOAuthConfig.clientAuthMethod === 'body') {
    return [
      { label: 'client-secret-post', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: false },
      { label: 'client-secret-post-browser', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: true },
    ];
  }

  return [
    { label: 'client-secret-basic', method: 'basic', includeClientId: false, includeClientSecret: false, browserLikeHeaders: false },
    { label: 'client-secret-basic-browser', method: 'basic', includeClientId: false, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'client-secret-basic-with-id', method: 'basic', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'public-browser', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'client-secret-post', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: false },
  ];
}

function tokenRequestHeaders(attempt: TokenAuthAttempt): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (attempt.browserLikeHeaders) {
    headers.Origin = predggOAuthConfig.frontendUrl;
    headers.Referer = `${predggOAuthConfig.frontendUrl}/`;
  }

  if (attempt.method === 'basic') {
    if (predggOAuthConfig.clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${predggOAuthConfig.clientId}:${predggOAuthConfig.clientSecret}`).toString('base64')}`;
    } else {
      logger.warn('pred.gg token auth method is basic but PRED_GG_CLIENT_SECRET is not configured');
    }
  }

  return headers;
}

function tokenBody(params: TokenGrant, attempt: TokenAuthAttempt): URLSearchParams {
  const body = new URLSearchParams();
  body.set('grant_type', params.grant_type);

  if (params.grant_type === 'authorization_code') {
    body.set('redirect_uri', predggOAuthConfig.callbackUrl);
    body.set('code', params.code);
    body.set('code_verifier', params.code_verifier);
  } else {
    body.set('refresh_token', params.refresh_token);
  }

  if (attempt.includeClientId) body.set('client_id', predggOAuthConfig.clientId);
  if (attempt.includeClientSecret && predggOAuthConfig.clientSecret) {
    body.set('client_secret', predggOAuthConfig.clientSecret);
  }

  return body;
}

export async function exchangeToken(params: TokenGrant): Promise<{
  ok: boolean;
  status: number;
  endpoint: string;
  attempt: string;
  data: TokenResponse;
}> {
  let lastResult: { ok: boolean; status: number; endpoint: string; attempt: string; data: TokenResponse } | undefined;

  for (const endpoint of predggOAuthConfig.tokenUrls) {
    for (const attempt of tokenAuthAttempts()) {
      const tokenRes = await fetch(endpoint, {
        method: 'POST',
        headers: tokenRequestHeaders(attempt),
        body: tokenBody(params, attempt).toString(),
      });
      const data = await tokenRes.json().catch(() => ({ error: 'invalid_token_response' })) as TokenResponse;
      lastResult = { ok: tokenRes.ok && !data.error, status: tokenRes.status, endpoint, attempt: attempt.label, data };
      logger.info({
        endpoint,
        status: tokenRes.status,
        error: data.error,
        clientAuthMethod: predggOAuthConfig.clientAuthMethod,
        tokenAuthAttempt: attempt.label,
      }, 'token exchange attempt');

      if (lastResult.ok) return lastResult;
      if (data.error === 'invalid_grant') return lastResult;
    }
  }

  return lastResult ?? {
    ok: false,
    status: 500,
    endpoint: 'none',
    attempt: 'none',
    data: { error: 'token_endpoint_not_configured' },
  };
}
