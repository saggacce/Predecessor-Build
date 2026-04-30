"""
pred.gg GraphQL and OAuth diagnostics.

This script is intentionally read-only. It can:
- Probe public GraphQL data and user-gated player queries.
- Compare unauthenticated, X-Api-Key, and Bearer-token auth modes.
- Build the OAuth authorize URL expected by the local app.
- Inspect HAR files and summarize the OAuth redirects that actually happened.

Examples:
  python explore_predgg_api.py
  python explore_predgg_api.py --har logs/Synexia_Match.har --har logs/Synexia_Match_1.har
  python explore_predgg_api.py --oauth-url
  python explore_predgg_api.py --access-token "$PREDGG_ACCESS_TOKEN"
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import requests

DEFAULT_GQL_URL = "https://pred.gg/gql"
DEFAULT_AUTHORIZE_URL = "https://pred.gg/oauth2/authorize"
DEFAULT_CALLBACK_URL = "http://localhost:3001/auth/callback"
DEFAULT_TOKEN_URL = "https://pred.gg/api/oauth2/token"
DEFAULT_SCOPES = "offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read"
TIMEOUT = 15
SENSITIVE_KEYS = {"client_secret", "PRED_GG_CLIENT_SECRET", "PREDGG_CLIENT_SECRET", "access_token", "refresh_token"}


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip('"').strip("'")

    for key, value in os.environ.items():
        if key.startswith("PRED_GG_") or key.startswith("PREDGG_"):
            env[key] = value

    return env


def pick(env: dict[str, str], *keys: str, default: str | None = None) -> str | None:
    for key in keys:
        value = env.get(key)
        if value:
            return value
    return default


def mask(value: str | None, keep: int = 6) -> str:
    if not value:
        return ""
    if len(value) <= keep * 2:
        return "*" * len(value)
    return f"{value[:keep]}...{value[-keep:]}"


def normalize_scopes(scopes: str | None) -> str:
    return " ".join((scopes or DEFAULT_SCOPES).split())


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def make_pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(64))
    challenge = b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def make_headers(api_key: str | None = None, bearer_token: str | None = None) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
    }
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    elif api_key:
        headers["X-Api-Key"] = api_key
    return headers


def gql(
    gql_url: str,
    query: str,
    variables: dict[str, Any] | None = None,
    api_key: str | None = None,
    bearer_token: str | None = None,
) -> requests.Response:
    payload: dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables
    return requests.post(
        gql_url,
        headers=make_headers(api_key=api_key, bearer_token=bearer_token),
        json=payload,
        timeout=TIMEOUT,
    )


@dataclass
class AuthMode:
    label: str
    api_key: str | None = None
    bearer_token: str | None = None


@dataclass
class Probe:
    label: str
    query: str
    variables: dict[str, Any] | None = None
    expected_private: bool = False


PUBLIC_PROBES = [
    Probe("heroes", "{ heroes { id name } }"),
    Probe("items", "{ items { id name slug } }"),
    Probe("perks", "{ perks { id name } }"),
    Probe("hero-detail-grux", '{ hero(by: { slug: "grux" }) { id name } }'),
    Probe("versions", "{ versions { id name releaseDate } }"),
    Probe("ratings", "{ ratings { id name } }"),
]

PRIVATE_PROBES = [
    Probe(
        "currentUser",
        "{ currentUser { id name } }",
        expected_private=True,
    ),
    Probe(
        "playersPaginated",
        """
        query SearchPlayer($name: String!) {
          playersPaginated(filter: { search: $name }, limit: 1) {
            results { id uuid name blockSearch }
          }
        }
        """,
        {"name": "Synexia"},
        expected_private=True,
    ),
    Probe(
        "leaderboardPaginated",
        """
        query Leaderboard {
          leaderboardPaginated(limit: 1) {
            results { rank player { id name } }
          }
        }
        """,
        expected_private=True,
    ),
]


def summarize_data(data: dict[str, Any] | None) -> str:
    if not data:
        return "no data"
    first_key = next(iter(data), None)
    if not first_key:
        return "empty"
    value = data.get(first_key)
    if isinstance(value, dict) and "results" in value and isinstance(value["results"], list):
        return f"{len(value['results'])} results"
    if isinstance(value, list):
        preview = json.dumps(value[0], ensure_ascii=False)[:70] if value else "empty"
        return f"{len(value)} records; first={preview}"
    return json.dumps(value, ensure_ascii=False)[:90]


def run_probe(gql_url: str, probe: Probe, mode: AuthMode) -> tuple[int, str, float]:
    started = time.perf_counter()
    try:
        resp = gql(
            gql_url,
            probe.query,
            variables=probe.variables,
            api_key=mode.api_key,
            bearer_token=mode.bearer_token,
        )
        elapsed = (time.perf_counter() - started) * 1000
        if resp.status_code != 200:
            return resp.status_code, f"HTTP {resp.status_code}: {resp.text[:120]}", elapsed
        body = resp.json()
        errors = body.get("errors") or []
        if errors:
            message = "; ".join((err.get("message") or "GraphQL error") for err in errors)
            return resp.status_code, f"GraphQL error: {message}", elapsed
        return resp.status_code, summarize_data(body.get("data")), elapsed
    except Exception as exc:  # noqa: BLE001 - diagnostic script should keep running
        elapsed = (time.perf_counter() - started) * 1000
        return 0, f"EXCEPTION: {exc}", elapsed


def introspect(gql_url: str, mode: AuthMode) -> None:
    query = """
    {
      __schema {
        queryType { fields { name description } }
        mutationType { fields { name description } }
      }
    }
    """
    print("\nSchema introspection")
    print("-" * 72)
    status, detail, elapsed = run_probe(gql_url, Probe("schema", query), mode)
    if detail.startswith("GraphQL error") or status != 200:
        print(f"  FAILED [{status}] {detail} ({elapsed:.0f} ms)")
        return

    resp = gql(gql_url, query, api_key=mode.api_key, bearer_token=mode.bearer_token)
    schema = resp.json().get("data", {}).get("__schema", {})
    queries = schema.get("queryType", {}).get("fields", [])
    mutations = schema.get("mutationType", {}).get("fields", [])
    print(f"  Queries:   {len(queries)}")
    print(f"  Mutations: {len(mutations)}")
    print("  Query names:    " + ", ".join(item["name"] for item in queries[:40]))
    print("  Mutation names: " + ", ".join(item["name"] for item in mutations[:40]))


def run_graphql_battery(gql_url: str, modes: list[AuthMode], include_private: bool) -> int:
    probes = PUBLIC_PROBES + (PRIVATE_PROBES if include_private else [])
    failures = 0

    print("\nGraphQL probe battery")
    print("-" * 92)
    print(f"  {'MODE':18} {'PROBE':24} {'HTTP':6} {'MS':8} RESULT")
    print("  " + "-" * 90)

    for mode in modes:
        for probe in probes:
            status, detail, elapsed = run_probe(gql_url, probe, mode)
            is_forbidden = "Forbidden" in detail
            if probe.expected_private and not mode.bearer_token and is_forbidden:
                verdict = "expected private gate"
            elif status == 200 and not detail.startswith("GraphQL error"):
                verdict = detail
            else:
                verdict = detail
                if not probe.expected_private:
                    failures += 1

            print(
                f"  {mode.label[:18].ljust(18)} "
                f"{probe.label[:24].ljust(24)} "
                f"{str(status).ljust(6)} "
                f"{elapsed:7.0f} "
                f"{verdict[:120]}"
            )
            time.sleep(0.15)

    return failures


def build_oauth_url(env: dict[str, str]) -> str:
    authorize_url = pick(env, "PRED_GG_AUTHORIZE_URL", default=DEFAULT_AUTHORIZE_URL) or DEFAULT_AUTHORIZE_URL
    if "/api/oauth2/authorize" in authorize_url:
        authorize_url = DEFAULT_AUTHORIZE_URL
    client_id = pick(env, "PRED_GG_CLIENT_ID", "PREDGG_CLIENT_ID", default="") or ""
    callback_url = pick(env, "PRED_GG_CALLBACK_URL", default=DEFAULT_CALLBACK_URL) or DEFAULT_CALLBACK_URL
    scopes = normalize_scopes(pick(env, "PRED_GG_OAUTH_SCOPES", default=DEFAULT_SCOPES))
    _verifier, challenge = make_pkce_pair()
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": scopes,
            "state": "diagnostic-state",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{authorize_url}?{query}"


def probe_authorize_url(url: str) -> None:
    print("\nOAuth authorize endpoint probe")
    print("-" * 72)
    print(f"  URL: {redact_url(url)}")
    try:
        resp = requests.get(url, allow_redirects=False, timeout=TIMEOUT)
    except Exception as exc:  # noqa: BLE001
        print(f"  FAILED: {exc}")
        return

    location = resp.headers.get("location", "")
    print(f"  HTTP: {resp.status_code}")
    if location:
        print(f"  Location: {redact_url(location)}")
        parsed = urlparse(location)
        params = parse_qs(parsed.query)
        if "error" in params:
            print(f"  OAuth error: {params['error'][0]}")


def request_authorize(url: str) -> tuple[int, str, str]:
    try:
        resp = requests.get(url, allow_redirects=False, timeout=TIMEOUT)
    except Exception as exc:  # noqa: BLE001
        return 0, "", str(exc)
    location = resp.headers.get("location", "")
    error = parse_qs(urlparse(location).query).get("error", [""])[0]
    return resp.status_code, location, error


def build_authorize_url(
    endpoint: str,
    client_id: str,
    callback_url: str,
    scopes: str,
    state: str,
    camel_case: bool,
    with_pkce: bool,
) -> str:
    params = {
        "clientId" if camel_case else "client_id": client_id,
        "redirectUri" if camel_case else "redirect_uri": callback_url,
        "responseType" if camel_case else "response_type": "code",
        "scope": scopes,
        "state": state,
    }
    if with_pkce:
        _verifier, challenge = make_pkce_pair()
        params["codeChallenge" if camel_case else "code_challenge"] = challenge
        params["codeChallengeMethod" if camel_case else "code_challenge_method"] = "S256"
    return f"{endpoint}?{urlencode(params)}"


def probe_oauth_variants(env: dict[str, str]) -> int:
    client_id = pick(env, "PRED_GG_CLIENT_ID", "PREDGG_CLIENT_ID", default="") or ""
    callback_url = pick(env, "PRED_GG_CALLBACK_URL", default=DEFAULT_CALLBACK_URL) or DEFAULT_CALLBACK_URL
    configured_endpoint = pick(env, "PRED_GG_AUTHORIZE_URL", default=DEFAULT_AUTHORIZE_URL) or DEFAULT_AUTHORIZE_URL
    configured_scopes = normalize_scopes(pick(env, "PRED_GG_OAUTH_SCOPES", default=DEFAULT_SCOPES))

    endpoints = unique(
        [
            configured_endpoint,
            "https://pred.gg/oauth2/authorize",
            "https://pred.gg/api/oauth2/authorize",
            "https://pred.gg/authorize",
            "https://pred.saibotu.de/api/oauth2/authorize",
        ]
    )
    scope_variants = unique(
        [
            configured_scopes,
            "offline_access",
            "profile",
            "",
            "offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read",
        ]
    )

    print("\nOAuth authorize variant probe")
    print("-" * 120)
    print(f"  {'ENDPOINT':44} {'PARAMS':10} {'PKCE':5} {'SCOPE':54} {'HTTP':6} RESULT")
    print("  " + "-" * 118)

    accepted = 0
    for endpoint in endpoints:
        for camel_case in (False, True):
            for with_pkce in (True, False):
                for scopes in scope_variants:
                    url = build_authorize_url(
                        endpoint=endpoint,
                        client_id=client_id,
                        callback_url=callback_url,
                        scopes=scopes,
                        state="diagnostic-state",
                        camel_case=camel_case,
                        with_pkce=with_pkce,
                    )
                    status, location, error = request_authorize(url)
                    result = error or ("redirect-no-error" if location else "no-redirect")
                    if status in (200, 302) and not error:
                        accepted += 1
                    print(
                        f"  {endpoint[:44].ljust(44)} "
                        f"{('camelCase' if camel_case else 'snake_case').ljust(10)} "
                        f"{('yes' if with_pkce else 'no').ljust(5)} "
                        f"{(scopes or '<empty>')[:54].ljust(54)} "
                        f"{str(status).ljust(6)} "
                        f"{result[:80]}"
                    )
                    time.sleep(0.1)

    if accepted == 0:
        print("  No variant avoided OAuth error. The client app registration may not match these redirect/scopes/endpoints.")
        return 1
    return 0


def probe_token_auth_variants(env: dict[str, str]) -> int:
    client_id = pick(env, "PRED_GG_CLIENT_ID", "PREDGG_CLIENT_ID", default="") or ""
    client_secret = pick(env, "PRED_GG_CLIENT_SECRET", "PREDGG_CLIENT_SECRET", default="") or ""
    callback_url = pick(env, "PRED_GG_CALLBACK_URL", default=DEFAULT_CALLBACK_URL) or DEFAULT_CALLBACK_URL
    token_url = pick(env, "PRED_GG_TOKEN_URL", default=DEFAULT_TOKEN_URL) or DEFAULT_TOKEN_URL

    print("\nOAuth token auth variant probe")
    print("-" * 96)
    if not client_id:
        print("  Skipped: PRED_GG_CLIENT_ID/PREDGG_CLIENT_ID missing.")
        return 1

    variants: list[tuple[str, dict[str, str], bool, bool]] = [
        ("public-body", {}, False, True),
        ("client-secret-body", {}, True, True),
    ]
    if client_secret:
        basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        variants.extend(
            [
                ("client-secret-basic", {"Authorization": f"Basic {basic}"}, False, True),
                ("client-secret-basic-no-id", {"Authorization": f"Basic {basic}"}, False, False),
                ("x-api-key", {"X-Api-Key": client_secret}, False, True),
            ]
        )

    print(f"  Token URL: {token_url}")
    print(f"  {'VARIANT':24} {'HTTP':6} RESULT")
    print("  " + "-" * 70)

    failures = 0
    accepted_credential = False
    for label, extra_headers, include_secret, include_client_id in variants:
        body = {
            "grant_type": "authorization_code",
            "redirect_uri": callback_url,
            "code": "diagnostic-invalid-code",
            "code_verifier": "diagnostic-code-verifier",
        }
        if include_client_id:
            body["client_id"] = client_id
        if include_secret and client_secret:
            body["client_secret"] = client_secret

        try:
            resp = requests.post(
                token_url,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": "http://localhost:5173",
                    "Referer": "http://localhost:5173/",
                    **extra_headers,
                },
                data=body,
                timeout=TIMEOUT,
            )
            try:
                data = resp.json()
            except Exception:  # noqa: BLE001
                data = {"raw": resp.text[:160]}
            error = data.get("error") or data.get("raw") or "<no error field>"
            if error != "invalid_client":
                accepted_credential = True
            print(f"  {label[:24].ljust(24)} {str(resp.status_code).ljust(6)} {str(error)[:80]}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"  {label[:24].ljust(24)} {'0'.ljust(6)} {exc}")

        time.sleep(0.1)

    if not accepted_credential:
        print("  All tested auth variants were rejected as invalid_client.")
        failures += 1
    else:
        print("  At least one variant passed client authentication; an invalid code should then fail later.")

    return failures


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def print_schema_type(gql_url: str, mode: AuthMode, type_name: str) -> int:
    query = """
    query TypeInfo($name: String!) {
      __type(name: $name) {
        name
        kind
        fields {
          name
          type {
            kind
            name
            ofType { kind name ofType { kind name } }
          }
        }
        inputFields {
          name
          type {
            kind
            name
            ofType { kind name ofType { kind name } }
          }
        }
      }
    }
    """
    status, detail, _elapsed = run_probe(gql_url, Probe(f"type-{type_name}", query, {"name": type_name}), mode)
    print(f"\nSchema type: {type_name}")
    print("-" * 72)
    if status != 200 or detail.startswith("GraphQL error"):
        print(f"  FAILED [{status}] {detail}")
        return 1
    resp = gql(gql_url, query, variables={"name": type_name}, api_key=mode.api_key, bearer_token=mode.bearer_token)
    type_info = resp.json().get("data", {}).get("__type")
    if not type_info:
        print("  Not found")
        return 1
    fields = type_info.get("fields") or type_info.get("inputFields") or []
    print(f"  {type_info.get('kind')} {type_info.get('name')}")
    for field in fields:
        print(f"    - {field.get('name')}: {format_type(field.get('type'))}")
    return 0


def format_type(type_info: dict[str, Any] | None) -> str:
    if not type_info:
        return "unknown"
    kind = type_info.get("kind")
    name = type_info.get("name")
    of_type = type_info.get("ofType")
    if name:
        return name
    if kind == "NON_NULL":
        return f"{format_type(of_type)}!"
    if kind == "LIST":
        return f"[{format_type(of_type)}]"
    return kind or "unknown"


def print_application(gql_url: str, mode: AuthMode, app_id: str | None) -> int:
    if not app_id:
        print("\nApplication metadata")
        print("-" * 72)
        print("  Skipped: PRED_GG_APP_ID/PREDGG_APP_ID missing.")
        return 0

    query = """
    query App($id: ID!) {
      application(id: $id) {
        id
        name
        clientId
      }
    }
    """
    print("\nApplication metadata")
    print("-" * 72)
    status, detail, _elapsed = run_probe(gql_url, Probe("application", query, {"id": app_id}), mode)
    if status != 200 or detail.startswith("GraphQL error"):
        print(f"  FAILED [{status}] {detail}")
        return 1
    resp = gql(gql_url, query, variables={"id": app_id}, api_key=mode.api_key, bearer_token=mode.bearer_token)
    application = resp.json().get("data", {}).get("application")
    if not application:
        print("  Application not found or not visible.")
        return 1
    print(f"  id:       {application.get('id')}")
    print(f"  name:     {application.get('name')}")
    print(f"  clientId: {mask(application.get('clientId'), keep=5)}")
    return 0


def redact_url(url: str) -> str:
    parsed = urlparse(url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    redacted: dict[str, list[str]] = {}
    for key, values in params.items():
        if key in SENSITIVE_KEYS or key in {"token", "code", "code_verifier"}:
            redacted[key] = [mask(values[0])]
        elif key == "client_id":
            redacted[key] = [mask(values[0], keep=5)]
        elif key == "state":
            redacted[key] = ["<state>"]
        else:
            redacted[key] = values
    query = urlencode(redacted, doseq=True)
    return parsed._replace(query=query).geturl()


def summarize_har(path: str) -> int:
    print(f"\nHAR OAuth summary: {path}")
    print("-" * 92)
    try:
        with open(path, encoding="utf-8") as handle:
            har = json.load(handle)
    except Exception as exc:  # noqa: BLE001
        print(f"  FAILED: {exc}")
        return 1

    entries = har.get("log", {}).get("entries", [])
    oauth_entries = []
    for entry in entries:
        url = entry.get("request", {}).get("url", "")
        if any(token in url for token in ("/auth/", "oauth", "authorize", "/gql")):
            oauth_entries.append(entry)

    if not oauth_entries:
        print("  No OAuth/Auth/GQL entries found.")
        return 0

    failures = 0
    for entry in oauth_entries:
        request = entry.get("request", {})
        response = entry.get("response", {})
        url = request.get("url", "")
        status = response.get("status")
        redirect = response.get("redirectURL") or header_value(response.get("headers", []), "location")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        scope = " ".join(params.get("scope", []))
        redirect_params = parse_qs(urlparse(redirect or "").query)
        error = redirect_params.get("error", [""])[0]
        auth_error = redirect_params.get("auth_error", [""])[0]

        print(f"  {request.get('method', 'GET'):4} {status!s:4} {redact_url(url)}")
        if scope:
            print(f"       scope: {scope}")
        if redirect:
            print(f"       -> {redact_url(redirect)}")
        if error:
            print(f"       OAuth error: {error}")
            failures += 1
        if auth_error:
            print(f"       Local auth error: {auth_error}")
            failures += 1
            if auth_error == "invalid_client":
                print("       Diagnosis: token exchange rejected client auth; run --probe-token-auth to compare none/body/basic.")
        if "pred.gg/api/oauth2/authorize" in url and "token" not in params:
            print("       Diagnosis: direct API authorize without pred.gg session token; start at /oauth2/authorize.")
            failures += 1
        if "pred.gg/api/oauth2/authorize" in url and "code_challenge" not in params:
            print("       Diagnosis: missing PKCE code_challenge.")
            failures += 1
        if "pred.gg/authorize" in url and "pred.gg/oauth2/authorize" not in url:
            print("       Diagnosis: obsolete SPA path; use https://pred.gg/oauth2/authorize.")
            failures += 1

    return failures


def header_value(headers: list[dict[str, str]], name: str) -> str:
    wanted = name.lower()
    for header in headers:
        if header.get("name", "").lower() == wanted:
            return header.get("value", "")
    return ""


def print_config(env: dict[str, str], gql_url: str, modes: list[AuthMode]) -> None:
    client_id = pick(env, "PRED_GG_CLIENT_ID", "PREDGG_CLIENT_ID", default="")
    callback_url = pick(env, "PRED_GG_CALLBACK_URL", default=DEFAULT_CALLBACK_URL)
    scopes = normalize_scopes(pick(env, "PRED_GG_OAUTH_SCOPES", default=DEFAULT_SCOPES))
    authorize_url = pick(env, "PRED_GG_AUTHORIZE_URL", default=DEFAULT_AUTHORIZE_URL)
    if authorize_url and "/api/oauth2/authorize" in authorize_url:
        authorize_url = f"{authorize_url} (ignored by local app; use {DEFAULT_AUTHORIZE_URL})"

    print("=" * 92)
    print("PRED.GG DIAGNOSTICS")
    print("=" * 92)
    print(f"  GraphQL URL:    {gql_url}")
    print(f"  OAuth URL:      {authorize_url}")
    print(f"  OAuth scopes:   {scopes}")
    print(f"  Callback URL:   {callback_url}")
    print(f"  Client ID:      {mask(client_id, keep=5) if client_id else '<missing>'}")
    print("  Auth modes:     " + ", ".join(mode.label for mode in modes))


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe pred.gg GraphQL/OAuth behavior.")
    parser.add_argument("--gql-url", default=None, help="GraphQL endpoint. Defaults to PRED_GG_GQL_URL or pred.gg.")
    parser.add_argument("--access-token", default=None, help="User OAuth access token for Bearer tests.")
    parser.add_argument("--no-api-key", action="store_true", help="Skip X-Api-Key mode even if secret is configured.")
    parser.add_argument("--private", action="store_true", help="Run player/currentUser private probes too.")
    parser.add_argument("--introspect", action="store_true", help="Print GraphQL operation names.")
    parser.add_argument("--oauth-url", action="store_true", help="Print the OAuth authorize URL built from env.")
    parser.add_argument("--probe-oauth", action="store_true", help="Make a no-follow request to the authorize URL.")
    parser.add_argument("--probe-oauth-variants", action="store_true", help="Try common authorize endpoint/param/scope variants.")
    parser.add_argument("--probe-token-auth", action="store_true", help="Try OAuth token endpoint client auth variants using a fake code.")
    parser.add_argument("--application", action="store_true", help="Fetch application metadata for PRED_GG_APP_ID.")
    parser.add_argument("--schema-type", action="append", default=[], help="Print fields for a GraphQL type.")
    parser.add_argument("--har", action="append", default=[], help="Analyze OAuth/Auth/GQL entries from a HAR file.")
    parser.add_argument("--skip-gql", action="store_true", help="Only run OAuth/HAR diagnostics, skip GraphQL probes.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    env = load_env()
    gql_url = args.gql_url or pick(env, "PRED_GG_GQL_URL", "PREDGG_GQL_URL", default=DEFAULT_GQL_URL) or DEFAULT_GQL_URL
    api_key = None if args.no_api_key else pick(env, "PRED_GG_CLIENT_SECRET", "PREDGG_CLIENT_SECRET")
    access_token = args.access_token or pick(env, "PRED_GG_ACCESS_TOKEN", "PREDGG_ACCESS_TOKEN")

    modes = [AuthMode("public")]
    if api_key:
        modes.append(AuthMode("x-api-key", api_key=api_key))
    if access_token:
        modes.append(AuthMode("bearer-token", bearer_token=access_token))

    print_config(env, gql_url, modes)

    failures = 0
    if args.oauth_url or args.probe_oauth:
        oauth_url = build_oauth_url(env)
        print("\nOAuth authorize URL")
        print("-" * 72)
        print(f"  {redact_url(oauth_url)}")
        if "pred.gg/api/oauth2/authorize" in oauth_url or "code_challenge=" not in oauth_url:
            print("  WARNING: this matches the incomplete OAuth pattern seen in the failing HAR files.")
            failures += 1
        if args.probe_oauth:
            probe_authorize_url(oauth_url)

    if args.probe_oauth_variants:
        failures += probe_oauth_variants(env)

    if args.probe_token_auth:
        failures += probe_token_auth_variants(env)

    for har_path in args.har:
        failures += summarize_har(har_path)

    if args.introspect and not args.skip_gql:
        introspect(gql_url, modes[-1])

    if args.application and not args.skip_gql:
        failures += print_application(gql_url, modes[-1], pick(env, "PRED_GG_APP_ID", "PREDGG_APP_ID"))

    if args.schema_type and not args.skip_gql:
        for type_name in args.schema_type:
            failures += print_schema_type(gql_url, modes[-1], type_name)

    if not args.skip_gql:
        include_private = args.private or bool(access_token)
        failures += run_graphql_battery(gql_url, modes, include_private=include_private)

    print("\n" + "=" * 92)
    if failures:
        print(f"Diagnostics completed with {failures} warning/failure signal(s).")
    else:
        print("Diagnostics completed without unexpected failures.")
    print("=" * 92)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
