# Predecessor Build Planner & Matchup Evaluator

Web-based analysis tool for [Predecessor](https://www.predecessorgame.com/) that helps players understand itemization, stat progression, and matchup dynamics.

## What it does

- **Build planner** — select a hero, level, item order, and skill order; see final and per-level stats
- **Build comparison** — compare two builds on the same hero with traceable numbers
- **Matchup evaluator** — weighted, explainable advantage report between two hero/build combos

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Backend | Node.js + TypeScript |
| Domain engine | Shared TypeScript package (pure functions) |
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

See [`docs/project_predecessor.md`](docs/project_predecessor.md) for product scope, [`docs/predecessor_api_technical_doc.md`](docs/predecessor_api_technical_doc.md) for API details, [`docs/future_features_roadmap.md`](docs/future_features_roadmap.md) for future capabilities, [`docs/workflow.md`](docs/workflow.md) for execution flow, and [`docs/planning.md`](docs/planning.md) for task tracking.
