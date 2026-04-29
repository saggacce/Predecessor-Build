import json
import os
import requests

GQL_URL = "https://pred.gg/gql"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}

TIMEOUT = 15


def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    for k in ["PREDGG_CLIENT_ID", "PREDGG_SCOPE"]:
        if k in os.environ:
            env[k] = os.environ[k]
    return env


def gql(query, variables=None, token=None):
    headers = {**HEADERS}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    return requests.post(GQL_URL, headers=headers, json=payload, timeout=TIMEOUT)


def get_token(client_id, scope):
    mutation = """
    mutation Authorize($clientId: String!, $scope: String!, $consent: Boolean!) {
      authorize(clientId: $clientId, scope: $scope, consent: $consent) {
        application { id name }
        token
      }
    }
    """
    resp = gql(mutation, {"clientId": client_id, "scope": scope, "consent": True})
    if resp.status_code != 200:
        return None, None, f"HTTP {resp.status_code}: {resp.text[:300]}"
    data = resp.json()
    errors = data.get("errors")
    if errors:
        return None, None, f"GraphQL errors: {json.dumps(errors, indent=2)}"
    authorize = data.get("data", {}).get("authorize", {})
    return authorize.get("token"), authorize.get("application", {}), None


def introspect_operations(token):
    query = """
    {
      __schema {
        queryType  { fields { name description } }
        mutationType { fields { name description } }
      }
    }
    """
    resp = gql(query, token=token)
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}: {resp.text[:300]}"
    data = resp.json()
    errors = data.get("errors")
    if errors:
        return None, f"GraphQL errors: {json.dumps(errors, indent=2)}"
    return data.get("data", {}).get("__schema", {}), None


def print_section(title, items, limit=30):
    print(f"\n  {title} ({len(items)} total):")
    print("  " + "-" * 60)
    for item in items[:limit]:
        desc = (item.get("description") or "")[:55]
        suffix = f"  — {desc}" if desc else ""
        print(f"    • {item['name']}{suffix}")
    if len(items) > limit:
        print(f"    ... y {len(items) - limit} más")


def main():
    env = load_env()
    client_id = env.get("PREDGG_CLIENT_ID")
    scope = env.get("PREDGG_SCOPE", "public")

    if not client_id:
        print("ERROR: PREDGG_CLIENT_ID no está configurado.")
        print("Crea un archivo .env con PREDGG_CLIENT_ID=<tu_client_id>")
        return

    print("=" * 65)
    print("PRED.GG API EXPLORER")
    print("=" * 65)
    print(f"\n→ Autenticando  clientId={client_id[:8]}...  scope={scope}")

    token, app, error = get_token(client_id, scope)
    if error:
        print(f"  FAILED: {error}")
        return

    if not token:
        print("  FAILED: la respuesta no incluyó token. Verifica el scope.")
        return

    print(f"  OK  token={token[:25]}...")
    if app:
        print(f"  Application: {app.get('name')}  (id: {app.get('id')})")

    print("\n→ Introspectando operaciones disponibles...")
    schema, error = introspect_operations(token)
    if error:
        print(f"  FAILED: {error}")
        return

    queries   = schema.get("queryType",    {}).get("fields", [])
    mutations = schema.get("mutationType", {}).get("fields", [])

    print_section("Queries", queries)
    print_section("Mutations", mutations)

    print("\n" + "=" * 65)
    print(f"Token para usar en otras llamadas:\n{token}")
    print("=" * 65)


if __name__ == "__main__":
    main()
