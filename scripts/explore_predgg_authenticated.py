"""
pred.gg GraphQL API — Authenticated Full Inventory
===================================================
Introspects the full schema and probes every query with and without
a Bearer token. Saves results to docs/predgg_api_inventory.md.

Usage:
    python3 scripts/explore_predgg_authenticated.py <bearer_token>

How to get your token:
    1. Log in at http://localhost:5173
    2. Open DevTools → Application → Cookies → localhost:3001
    3. Copy the value of 'predgg_token'
"""

import json
import os
import sys
import time
from datetime import datetime
import requests

GQL_URL = "https://pred.gg/gql"
TIMEOUT = 20
DELAY = 0.3

TOKEN = sys.argv[1] if len(sys.argv) > 1 else None

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "predgg_api_inventory.md")


def req(query, variables=None, auth=True):
    h = {"Content-Type": "application/json", "User-Agent": "Predecessor-Build/inventory"}
    if auth and TOKEN:
        h["Authorization"] = f"Bearer {TOKEN}"
    time.sleep(DELAY)
    r = requests.post(GQL_URL, headers=h, json={"query": query, "variables": variables or {}}, timeout=TIMEOUT)
    return r.json()


INTROSPECT = """
{
  __schema {
    queryType { fields { name description isDeprecated
      args { name type { name kind ofType { name kind ofType { name } } } }
      type { name kind ofType { name kind ofType { name } } } } }
    mutationType { fields { name isDeprecated } }
  }
}
"""

TYPE_Q = """
query T($name: String!) {
  __type(name: $name) {
    name kind description
    fields { name description isDeprecated
      type { name kind ofType { name kind ofType { name } } }
      args { name type { name kind ofType { name } } } }
    inputFields { name type { name kind ofType { name } } }
    enumValues { name }
  }
}
"""

PROBES = {
    "heroes":               '{ heroes { id name slug } }',
    "hero":                 '{ hero(by: { slug: "grux" }) { id name slug } }',
    "items":                '{ items { id name slug } }',
    "item":                 '{ item(by: { slug: "ashbringer" }) { id name } }',
    "perks":                '{ perks { id name slug } }',
    "versions":             '{ versions { id name releaseDate patchType } }',
    "ratings":              '{ ratings { id name startTime endTime } }',
    "teams":                '{ teams { id name } }',
    "events":               '{ events { id } }',
    "groups":               '{ groups { id } }',
    "currentUser":          '{ currentUser { id username } }',
    "currentAuth":          '{ currentAuth { application { id name } } }',
    "connectionInfo":       '{ connectionInfo { ip country } }',
    "backend":              '{ backend { version } }',
    "player":               '{ player(by: { id: "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82" }) { id name uuid } }',
    "players":              '{ players(by: [{ id: "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82" }]) { id name } }',
    "playersPaginated":     '{ playersPaginated(filter: { search: "saggacce" }, limit: 1) { results { id name } totalCount } }',
    "leaderboardPaginated": '{ leaderboardPaginated(ratingId: "11", limit: 3, offset: 0) { results { points rank { name } player { id name } } totalCount } }',
    "ratingStatistic":      '{ ratingStatistic(ratingId: "11", granularity: WEEK) { results { timestamp value } } }',
    "rating":               '{ rating(by: { id: "11" }) { id name startTime } }',
    "version":              '{ version(by: { id: "143" }) { id name releaseDate } }',
    "team":                 '{ team(id: "1") { id name } }',
    "matchSpoilerBlocks":   '{ matchSpoilerBlocks { id } }',
    "guidesPaginated":      '{ guidesPaginated(limit: 2, offset: 0) { results { id } } }',
    "applicationsPaginated":'{ applicationsPaginated(limit: 1, offset: 0) { results { id name } } }',
}

KEY_TYPES = [
    "Player", "PlayerGeneralStatistic", "PlayerHeroStatistic",
    "PlayerRoleStatistic", "PlayerRating", "Match", "MatchPlayer",
    "Hero", "Item", "Perk", "Version", "Rating", "Team",
    "User", "Application", "Rank",
]


def rtype(t):
    if not t: return "?"
    k, n, inner = t.get("kind",""), t.get("name") or "", t.get("ofType")
    if k == "NON_NULL": return f"{rtype(inner)}!"
    if k == "LIST":     return f"[{rtype(inner)}]"
    return n or k


def classify(r):
    if r is None: return "⚪ no token", None
    errs = r.get("errors", [])
    data = r.get("data", {})
    if errs:
        msg = errs[0].get("message","error")
        if msg.lower() in ("forbidden","unauthorized"): return "❌ Forbidden", None
        if "not found" in msg.lower(): return "⚠️ NotFound (query ok)", None
        return f"⚠️ {msg[:60]}", None
    vals = list(data.values()) if data else []
    if vals and all(v is None for v in vals): return "⚠️ null (query ok)", data
    if data: return "✅ OK", data
    return "✅ OK (empty)", data


def probe(name, query):
    rp, da = classify(req(query, auth=False))
    ra, db_ = classify(req(query, auth=True) if TOKEN else None)
    sample = ""
    d = db_ or da
    if d:
        s = json.dumps(d, default=str)
        sample = s[:200] + ("..." if len(s)>200 else "")
    return rp, ra, sample


def main():
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    def w(s=""): lines.append(s); print(s)

    w(f"# pred.gg GraphQL API — Full Inventory")
    w(f"")
    w(f"**Generated:** {ts}  ")
    w(f"**Endpoint:** `{GQL_URL}`  ")
    w(f"**Token:** {'✅ provided' if TOKEN else '❌ not provided — auth column empty'}")
    w()

    # Schema
    w("---"); w()
    print("▶ Introspecting schema...", flush=True)
    schema = req(INTROSPECT, auth=bool(TOKEN)).get("data",{}).get("__schema",{})
    queries   = schema.get("queryType",{}).get("fields",[]) or []
    mutations = schema.get("mutationType",{}).get("fields",[]) or []

    w(f"## Schema overview")
    w(f"- **Queries:** {len(queries)}")
    w(f"- **Mutations:** {len(mutations)}")
    w()

    # Query inventory table
    w("## Queries")
    w()
    w("| Query | Args | Returns | Deprecated |")
    w("|-------|------|---------|------------|")
    for q in sorted(queries, key=lambda x: x["name"]):
        args = ", ".join(f"`{a['name']}`" for a in (q.get("args") or []))
        ret  = f"`{rtype(q.get('type'))}`"
        dep  = "⚠️" if q.get("isDeprecated") else ""
        w(f"| `{q['name']}` | {args} | {ret} | {dep} |")
    w()

    # Mutations list
    w("## Mutations")
    w()
    w("| Mutation | Deprecated |")
    w("|----------|------------|")
    for m in sorted(mutations, key=lambda x: x["name"]):
        dep = "⚠️" if m.get("isDeprecated") else ""
        w(f"| `{m['name']}` | {dep} |")
    w()

    # Access probes
    w("---")
    w()
    w("## Access probe — public vs authenticated")
    w()
    w("| Query | Without token | With token |")
    w("|-------|---------------|------------|")

    results = {}
    for name, query in PROBES.items():
        print(f"  Probing {name}...", end="\r", flush=True)
        rp, ra, sample = probe(name, query)
        results[name] = {"public": rp, "auth": ra, "sample": sample}
        w(f"| `{name}` | {rp} | {ra} |")
    print(" " * 40, end="\r")
    w()

    # Sample data for accessible queries
    w("### Sample data (authenticated)")
    w()
    for name, r in results.items():
        if r["sample"] and r["auth"] and r["auth"].startswith("✅"):
            w(f"**`{name}`**")
            w(f"```json")
            w(r["sample"])
            w(f"```")
            w()

    # Type inventory
    w("---")
    w()
    w("## Type field inventory")
    w()
    for type_name in KEY_TYPES:
        print(f"  Introspecting {type_name}...", end="\r", flush=True)
        resp = req(TYPE_Q, {"name": type_name})
        t = resp.get("data",{}).get("__type")
        if not t: continue
        fields = t.get("fields") or t.get("inputFields") or t.get("enumValues") or []
        w(f"### `{type_name}`  ({len(fields)} fields)")
        w()
        if fields:
            w("| Field | Type | Deprecated |")
            w("|-------|------|------------|")
            for f in fields:
                fname = f.get("name","")
                ftype = rtype(f.get("type")) if f.get("type") else ""
                dep = "⚠️" if f.get("isDeprecated") else ""
                w(f"| `{fname}` | `{ftype}` | {dep} |")
        w()
    print(" " * 40, end="\r")

    # Summary
    w("---")
    w()
    w("## Summary")
    w()
    public_ok  = [n for n,r in results.items() if r["public"].startswith("✅")]
    auth_works = [n for n,r in results.items() if not r["public"].startswith("✅") and (r["auth"] or "").startswith("✅")]
    still_fail = [n for n,r in results.items() if not r["public"].startswith("✅") and not (r["auth"] or "").startswith("✅")]

    w(f"### ✅ Public (no auth required) — {len(public_ok)} queries")
    w()
    for n in public_ok: w(f"- `{n}`")
    w()
    w(f"### 🔑 Unlocked with Bearer token — {len(auth_works)} queries")
    w()
    for n in auth_works: w(f"- `{n}`")
    w()
    w(f"### ❌ Still inaccessible — {len(still_fail)} queries")
    w()
    for n in still_fail:
        w(f"- `{n}` → {results[n]['auth'] or 'no token'}")
    w()

    # Write to file
    content = "\n".join(lines)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(content + "\n")

    print(f"\n✅ Saved to docs/predgg_api_inventory.md")


if __name__ == "__main__":
    main()
