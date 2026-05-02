# Data Quality & Freshness Policy

This document defines how the Predecessor Build platform manages external data quality, freshness, and reliability.

---

## 1. Data Sources

| Source | Type | Auth | Data provided |
|--------|------|------|---------------|
| pred.gg | GraphQL | Bearer token (OAuth2 PKCE) | Players, matches, teams, versions, ratings, hero/item data |

> **Note:** omeda.city was originally evaluated as a secondary source but is no longer used. pred.gg provides all required data including heroes, items, and patches.

---

## 2. Freshness Strategy

### Player data
- **Stale threshold:** 1 hour (`STALE_THRESHOLD_MS = 3_600_000`)
- **Trigger:** `syncStalePlayers()` refreshes all players whose `lastSynced` is older than the threshold
- **Snapshot model:** Each sync creates a new `PlayerSnapshot` preserving historical stats — previous values are never overwritten

### Match data
- **Deduplication:** Matches are keyed by `predggUuid`. If a match already exists in the database, it is skipped
- **Player linking:** `MatchPlayer` records link to internal `Player` records when the player has been previously synced. Unknown players are stored by name only

### Version / Patch data
- **Full sync:** All versions are upserted on every sync run
- **Tracking:** `syncedAt` timestamp on each version record

---

## 3. Versioning

All synced data is versioned along two axes:

1. **Patch version** — `Version.predggId` links to the game patch. `Match`, `PlayerSnapshot` reference their associated version
2. **Sync timestamp** — Every record has a `syncedAt` field indicating when it was last ingested

This enables:
- Filtering stats by patch window
- Tracking data freshness
- Reproducing any historical view

---

## 4. Fallback & Resilience

- **Cached data:** If the external API is unavailable, the system continues serving data from the local PostgreSQL database
- **Error isolation:** Individual sync failures (e.g. one match fails to fetch) are logged to `SyncLog` with `status: 'error'` but do not abort the entire sync run
- **Rate limiting:** The GraphQL client enforces a 100ms delay between requests (~10 req/s) to respect pred.gg's infrastructure

---

## 5. Private / Hidden Players

- Players with `blockSearch: true` or `name: 'HIDDEN'` are marked as `isPrivate: true`
- Their data is still synced and stored but may be excluded from public-facing views
- The system does not attempt to de-anonymize hidden players

---

## 6. Audit Trail

Every sync operation creates a `SyncLog` record:

```
entity:    'player' | 'match' | 'version' | 'system'
entityId:  external ID or name
operation: 'upsert' | 'fetch' | command name
status:    'ok' | 'error' | 'skipped'
error:     error message (if applicable)
syncedAt:  timestamp
```

This allows:
- Debugging failed syncs
- Measuring sync coverage
- Tracking data pipeline health

---

## 7. Recommended Sync Schedule

| Operation | Frequency | Command |
|-----------|-----------|---------|
| Full sync (versions + stale players) | Every 30 minutes | `npm run sync -- sync-all` |
| Individual player sync | On demand | `npm run sync -- sync-player <name>` |
| Match history sync | On demand / after scrim | `npm run sync -- sync-player-matches <id>` |
| Version sync after patch day | Immediately | `npm run sync -- sync-versions` |
