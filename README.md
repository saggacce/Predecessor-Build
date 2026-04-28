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

## Project structure

```
apps/
  web/          → React frontend
  api/          → Node.js backend
packages/
  domain-engine/  → Stat and matchup calculation (no UI deps)
  data-model/     → Shared types and DTOs
workers/
  data-sync/    → Omeda.city / pred.gg ingestion and normalization
docs/
  project_predecessor.md           → Product specification
  predecessor_api_technical_doc.md → API reference (REST + GraphQL)
scripts/
  explore_omeda_api.py  → One-shot API audit tool
  api-samples/          → Raw API response fixtures (used in tests)
```

## Delivery phases

| Phase | Deliverable |
|-------|-------------|
| 1 | Data ingestion + normalized schema + stat calculator |
| 2 | Build planner UI + per-level/per-item breakdown |
| 3 | Same-hero build comparison |
| 4 | Matchup evaluator with explainable weighted scoring |
| 5 | Patch handling, saved builds, recommendation helpers |

## Data sources

- **REST** — `omeda.city` (heroes, items, builds — no auth required)
- **GraphQL** — `pred.gg/gql` (matchups, win rates, player data — OAuth2 required)

See [`docs/predecessor_api_technical_doc.md`](docs/predecessor_api_technical_doc.md) for full API reference.
