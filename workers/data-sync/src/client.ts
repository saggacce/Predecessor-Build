/**
 * @fileoverview pred.gg GraphQL client for the data-sync worker.
 *
 * Thin wrapper around the pred.gg GraphQL endpoint with:
 * - Self-throttling at 10 req/s (100ms minimum delay between requests)
 * - X-Api-Key header using PRED_GG_CLIENT_SECRET env var
 * - Typed response unwrapping (throws on HTTP errors and GraphQL errors)
 *
 * This client is used only by the standalone data-sync worker (workers/data-sync/).
 * The main API service (apps/api/) uses a separate predggQuery function in sync-service.ts
 * that additionally supports Bearer tokens for authenticated endpoints.
 *
 * Rate limit: pred.gg has no published rate limit, but we self-impose 10 req/s
 * to avoid triggering server-side throttling. See workflow.md if this needs adjustment.
 */

const GQL_URL = 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;

/** Minimum delay between consecutive requests — enforces 10 req/s self-imposed limit */
const REQUEST_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a GraphQL query against the pred.gg API.
 * Automatically throttles to 10 req/s and injects the API key header.
 *
 * @template T - Expected shape of the `data` field in the GraphQL response
 * @param query - GraphQL query string
 * @param variables - Optional variables object
 * @returns Unwrapped `data` field from the GraphQL response
 * @throws {Error} on HTTP error or GraphQL errors array
 */
export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  // Enforce rate limit before every request
  await sleep(REQUEST_DELAY_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'RiftLine/1.0 (data-sync; contact@riftline.app)',
  };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`pred.gg HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`pred.gg GraphQL: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  return json.data as T;
}
