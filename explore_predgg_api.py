"""
pred.gg GraphQL API Explorer

Auth findings:
- Public game data (heroes, items, matches) is accessible without authentication.
- The clientSecret can be sent as X-Api-Key header (likely for elevated rate limits
  or access to additional endpoints).
- The `authorize` mutation is for user-facing OAuth2 consent flows (requires an
  active user session) — not usable for machine-to-machine access.
"""

import json
import os
import time
import requests

GQL_URL = "https://pred.gg/gql"
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
    for k in ["PREDGG_CLIENT_ID", "PREDGG_CLIENT_SECRET"]:
        if k in os.environ:
            env[k] = os.environ[k]
    return env


def make_headers(api_key=None):
    headers = {
        "Content-Type": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
    }
    if api_key:
        headers["X-Api-Key"] = api_key
    return headers


def gql(query, variables=None, api_key=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(
        GQL_URL,
        headers=make_headers(api_key),
        json=payload,
        timeout=TIMEOUT,
    )
    return resp


def introspect_operations(api_key=None):
    query = """
    {
      __schema {
        queryType    { fields { name description } }
        mutationType { fields { name description } }
      }
    }
    """
    resp = gql(query, api_key=api_key)
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}: {resp.text[:300]}"
    data = resp.json()
    if data.get("errors"):
        return None, f"GraphQL errors: {json.dumps(data['errors'], indent=2)}"
    return data.get("data", {}).get("__schema", {}), None


# ── Sample queries ──────────────────────────────────────────────────────────

SAMPLE_QUERIES = [
    (
        "heroes",
        "{ heroes { id name } }",
    ),
    (
        "items",
        "{ items { id name slug } }",
    ),
    (
        "perks (crests)",
        "{ perks { id name } }",
    ),
    (
        "hero-detail (Grux)",
        '{ hero(by: { slug: "grux" }) { id name } }',
    ),
    (
        "versions (patches)",
        "{ versions { id name releaseDate } }",
    ),
    (
        "ratings (seasons)",
        "{ ratings { id name } }",
    ),
]


def run_sample(label, query, api_key=None):
    try:
        resp = gql(query, api_key=api_key)
        status = resp.status_code
        if status != 200:
            return status, 0, f"HTTP {status}", None
        data = resp.json()
        errors = data.get("errors")
        if errors:
            return status, 0, errors[0].get("message", "error"), None
        kb = len(resp.content) / 1024
        return status, kb, None, data.get("data")
    except Exception as exc:
        return 0, 0, str(exc), None


def print_section(title, items, limit=40):
    print(f"\n  {title} ({len(items)} total):")
    print("  " + "-" * 62)
    for item in items[:limit]:
        desc = (item.get("description") or "")[:55]
        suffix = f"  — {desc}" if desc else ""
        print(f"    • {item['name']}{suffix}")
    if len(items) > limit:
        print(f"    ... y {len(items) - limit} más")


def main():
    env = load_env()
    api_key = env.get("PREDGG_CLIENT_SECRET")

    print("=" * 65)
    print("PRED.GG API EXPLORER")
    print("=" * 65)
    auth_mode = f"X-Api-Key={api_key[:8]}..." if api_key else "sin autenticación (público)"
    print(f"\n  Modo: {auth_mode}")

    # ── Schema introspection ────────────────────────────────────────────────
    print("\n→ Introspectando esquema GraphQL...")
    schema, error = introspect_operations(api_key)
    if error:
        print(f"  FAILED: {error}")
    else:
        queries   = schema.get("queryType",    {}).get("fields", [])
        mutations = schema.get("mutationType", {}).get("fields", [])
        print_section("Queries disponibles", queries)
        print_section("Mutations disponibles", mutations)

    # ── Sample data queries ─────────────────────────────────────────────────
    print("\n\n→ Probando queries de datos...")
    print("  " + "-" * 62)
    col_label  = 24
    col_status = 8
    col_kb     = 8
    print(
        "  " + "ENDPOINT".ljust(col_label)
        + "STATUS".ljust(col_status)
        + "KB".ljust(col_kb)
        + "RESULTADO"
    )
    print("  " + "-" * 62)

    for label, query in SAMPLE_QUERIES:
        status, kb, error, data = run_sample(label, query, api_key)
        if error:
            detail = f"ERROR: {error}"[:50]
        else:
            # Show first record as preview
            first_key = next(iter(data), None)
            value = data.get(first_key) if first_key else None
            if isinstance(value, list):
                detail = f"{len(value)} registros  — primero: {json.dumps(value[0])[:60]}"
            else:
                detail = str(value)[:80]
        print(
            "  " + label.ljust(col_label)
            + str(status).ljust(col_status)
            + f"{kb:.1f}".ljust(col_kb)
            + detail
        )
        time.sleep(0.5)

    print("\n" + "=" * 65)
    print("Nota: para datos de usuario/jugador se necesita OAuth2 con")
    print("sesión de usuario (authorize mutation, flujo interactivo).")
    print("=" * 65)


if __name__ == "__main__":
    main()
