# pred.gg API — Technical Documentation

Technical reference for integrating the pred.gg GraphQL API into the Predecessor Build project.
Updated from live introspection and authentication testing.

---

## 1. Endpoint

| Type     | URL                      |
|----------|--------------------------|
| GraphQL  | `https://pred.gg/gql`    |
| Method   | `POST`                   |
| Content  | `application/json`       |

---

## 2. Authentication

### 2.1 Summary of findings

| Method                          | Result  | Notes                                              |
|---------------------------------|---------|----------------------------------------------------|
| No auth header                  | ✅ Works | Full access to public game data                    |
| `X-Api-Key: <clientSecret>`     | ✅ Works | Same public data; likely elevates rate limits      |
| `Authorization: Basic <base64>` | ❌ 401   | Server rejects at HTTP middleware level            |
| `Authorization: Bearer <token>` | ❌ 401   | Server rejects at HTTP middleware level            |
| `authorize` GraphQL mutation    | ❌ Forbidden | Requires active user session (interactive flow)|

### 2.2 Public access

All public game data (heroes, items, matches, builds) is accessible without any
authentication header. This is the primary access mode for the data sync worker.

```http
POST https://pred.gg/gql
Content-Type: application/json

{"query": "{ heroes { id name } }"}
```

### 2.3 Application credentials (X-Api-Key)

Sending the `clientSecret` as an `X-Api-Key` header is accepted by the server.
Recommended for production use to avoid rate limiting issues.

```http
POST https://pred.gg/gql
Content-Type: application/json
X-Api-Key: <PREDGG_CLIENT_SECRET>

{"query": "{ heroes { id name } }"}
```

Credentials are stored in `.env` (see `.env.example`):

```
PREDGG_APP_ID=HiDUme4
PREDGG_CLIENT_ID=l5vdyvqawgovh2qptnumwrsb11ufanyf
PREDGG_CLIENT_SECRET=<client_secret>
```

### 2.4 The `authorize` mutation — user OAuth2 flow (not for scripts)

The `authorize` mutation exists for user-facing OAuth2 consent (e.g. "Login with pred.gg").
It is **not usable for machine-to-machine access** because it requires an active user session.

Schema (from introspection):
```graphql
mutation Authorize($clientId: String!, $scope: String!, $consent: Boolean!) {
  authorize(clientId: $clientId, scope: $scope, consent: $consent) {
    application { id name }
    token
  }
}
```

Returns `Forbidden` when called without a user session, regardless of scope value.
Do not use this mutation in the data sync worker or any backend script.

---

## 3. Making GraphQL requests

### Python (requests)

```python
import requests

GQL_URL = "https://pred.gg/gql"

def gql(query, variables=None, api_key=None):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Api-Key"] = api_key
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    return requests.post(GQL_URL, headers=headers, json=payload, timeout=15)
```

### PowerShell (testing / exploration)

```powershell
$body = '{"query":"{ heroes { id name } }"}'
Invoke-WebRequest -UseBasicParsing -Uri "https://pred.gg/gql" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body | Select-Object -ExpandProperty Content
```

---

## 4. Known queries

Discovered via GraphQL introspection (`__schema`). The full list has 50+ queries.
Key ones relevant to this project:

| Query            | Description                                 |
|------------------|---------------------------------------------|
| `heroes`         | List all heroes with id and name            |
| `hero(name:)`    | Single hero detail (abilities, stats, etc.) |
| `items`          | List all items                              |
| `matches`        | Match history                               |
| `player`         | Player profile and stats                    |

For the complete list run:
```python
python explore_predgg_api.py
```

---

## 5. Schema introspection

To discover available queries and mutations at any time:

```graphql
{
  __schema {
    queryType    { fields { name description } }
    mutationType { fields { name description } }
  }
}
```

To inspect a specific type (example: `AuthorizeResult`):

```graphql
{
  __type(name: "AuthorizeResult") {
    fields { name type { name kind ofType { name kind } } }
  }
}
```

---

## 6. Error reference

| HTTP Status | GraphQL error message | Cause                                                |
|-------------|----------------------|------------------------------------------------------|
| 200         | `Forbidden`          | Operation requires user session (authorize mutation) |
| 401         | —                    | Invalid Authorization header — do not use Basic/Bearer |
| 403         | `Host not in allowlist` | Request origin blocked by pred.gg (server-side calls from non-whitelisted IPs) |
| 200         | Schema validation errors | Wrong argument or field names in the query       |

> **Note on 403 host_not_allowed:** pred.gg may block requests from certain server IPs.
> If the data sync worker is deployed on a VPS and receives 403, the workaround is to
> route requests through a residential proxy or contact pred.gg to whitelist the IP.

---

## 7. Rate limits

Not officially documented. Using `X-Api-Key` with the application clientSecret is
recommended to identify the application and avoid anonymous rate limiting.

---

## 8. Data dependency policy (from project spec)

- Ingest into internal normalized schema — never expose pred.gg types directly to the frontend.
- Version all synced data by patch and sync timestamp.
- Maintain a fallback cache so the app remains functional if pred.gg is temporarily unavailable.
- The sync worker (`workers/data-sync`) is the only component that talks to pred.gg directly.
