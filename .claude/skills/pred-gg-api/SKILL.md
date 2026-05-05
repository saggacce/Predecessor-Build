---
name: pred-gg-api
description: Load when working on sync worker, GraphQL queries, event stream data, or any pred.gg API integration.
---

# pred.gg API — Integration Reference

## Endpoint
`https://pred.gg/gql` — GraphQL (POST)

## Auth model
| Access | Endpoints |
|--------|-----------|
| **Public (no auth)** | heroes, items, versions, ratings, teams, `player(by: { id })`, match basic |
| **Bearer token required** | `playersPaginated`, `players` (batch), `leaderboardPaginated`, all event stream fields |

Bearer token comes from the user's active OAuth2 session (HTTP-only cookie → forwarded in sync requests).

## Confirmed event stream fields (Bearer required)
| Field | Key data available |
|-------|--------------------|
| `heroKills` | `gameTime`, `location {x y z}`, killer/killed player+hero+team |
| `objectiveKills` | `gameTime`, `killedEntityType` (FANGTOOTH, PRIMAL_FANGTOOTH, ORB_PRIME, MINI_PRIME, buffs…), `killerTeam` |
| `structureDestructions` | `gameTime`, `structureEntityType`, `destructionTeam`, `location {x y z}` |
| `wardPlacements` / `wardDestructions` | `gameTime`, `type` (STEALTH/ORACLE/SENTRY/SONAR_DRONE/SOLSTONE_DRONE), `location` |
| `goldEarnedAtInterval` | Array of cumulative gold — 1 value per minute per player |
| `transactions` | `gameTime`, `transactionType` (BUY/SELL/UNDO_BUY/UNDO_SELL), `itemData { name icon smallIcon }` |
| `heroBans` | `hero` + `team` — **RANKED matches only. No pick order, no ban sequence.** |

## Known API gotchas (verified May 2026)
- Event list fields have **no `limit` argument** — fetch all, there is no pagination
- `match` query uses `by: { id: "..." }` — not `uuid`, not `slug`
- `ItemData` available fields: `name`, `icon`, `smallIcon` — field `slug` does not exist
- Player stat result field: `result` (singular) — not `results`
- `structureEntityType` — not `structureType` or `structureTeam`

## Player data model
- 60% of players have `name: null` — no pred.gg account (typically console players)
- UUID and all stats are fully accessible regardless of account status
- Privacy settings (`blockSearch` / `blockName`) are effectively unused — 0/254 players sampled had them set
- Display logic everywhere: `customName ?? displayName ?? "Unknown"`

## Key files
| File | Purpose |
|------|---------|
| `workers/data-sync/src/client.ts` | GraphQL client wrapper |
| `workers/data-sync/src/sync/players.ts` | Player sync logic |
| `workers/data-sync/src/sync/matches.ts` | Match sync logic |
| `workers/data-sync/prisma/schema.prisma` | DB schema (Player, Match, Team, etc.) |
| `docs/predgg_api_inventory.md` | Full GraphQL field inventory |
| `docs/predecessor_api_technical_doc.md` | Auth flow and integration reference |
