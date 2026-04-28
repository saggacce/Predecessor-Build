# Predecessor Competitive Intelligence Platform

Web-based platform for [Predecessor](https://www.predecessorgame.com/) focused on **player tracking, scouting, and match preparation** first, and **build simulation** second.

## Product direction (updated)

- **Phase-first objective**: create practical tools for coaches/analysts to prepare scrims and official matches.
- **Secondary objective**: add a build calculator that explains stat changes by level, abilities, and items.
- **Long-term vision**: approach a LoL-style competitive companion experience (similar in spirit to iTero) adapted to Predecessor data constraints.

## Core capabilities by stage

### Stage A — Competitive scouting (current priority)
- Player tracking dashboard (form, role trends, comfort picks, patch windows)
- Rival scouting reports (player and team level)
- Match preparation summaries for scrims and official games
- Team analysis (identity, draft tendencies, performance splits)

### Stage B — Draft and preparation intelligence
- Draft support recommendations from historical tendencies
- Risk indicators (target bans, role-flex risks, comfort-denial opportunities)
- Explainable confidence bands, never “guaranteed winner” claims

### Stage C — Build and stat simulation
- Hero level scaling + item progression + skill order impacts
- Build comparison for the same hero
- Explainable stat deltas and power-spike timeline

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Analytics engines | Shared TypeScript packages (pure functions) |
| Database | PostgreSQL |
| Cache | Redis |
| Data source | Omeda.city REST API + pred.gg GraphQL API |

## Project structure (target)

```
apps/
  web/             → React frontend (dashboards and reports)
  api/             → Node.js backend
packages/
  scouting-engine/ → Player/team scouting metrics and scoring
  domain-engine/   → Build/stat calculation (phase B/C)
  data-model/      → Shared types and DTOs
workers/
  data-sync/       → Omeda.city / pred.gg ingestion and normalization
docs/
  project_predecessor.md            → Product + technical specification
  predecessor_api_technical_doc.md  → API integration reference
  future_features_roadmap.md        → Pending capabilities with priority/effort
scripts/
  explore_omeda_api.py  → One-shot API audit tool
  api-samples/          → Raw API response fixtures (used in tests)
```

## Delivery roadmap

| Phase | Deliverable |
|-------|-------------|
| 1 | Data ingestion + normalized schema + player/team scouting foundation |
| 2 | Scouting dashboards + rival reports + scrim prep summaries |
| 3 | Draft-support recommendations (explainable) |
| 4 | Build/stat calculator (level/skills/items) |
| 5 | Iterative intelligence upgrades and advanced recommendations |

## Data sources

- **REST** — `omeda.city` (heroes, items, builds — no auth required)
- **GraphQL** — `pred.gg/gql` (players, matches, teams, matchups — OAuth2 required)

See [`docs/predecessor_api_technical_doc.md`](docs/predecessor_api_technical_doc.md) for API details and [`docs/future_features_roadmap.md`](docs/future_features_roadmap.md) for pending capabilities.
