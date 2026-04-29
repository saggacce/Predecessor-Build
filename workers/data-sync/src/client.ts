const GQL_URL = 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;
const REQUEST_DELAY_MS = 100; // 10 req/s max

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  await sleep(REQUEST_DELAY_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Predecessor-Build/0.1 (data-sync)',
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
