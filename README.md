# Predecessor Build — Competitive Scouting Platform

Web-based competitive analysis tool for [Predecessor](https://www.predecessorgame.com/) that helps coaches and players scout rivals, track rosters, and prepare for scrims with real match data.

## Current state

**Phases 1 & 2 complete.** The scouting layer is live and stable.

| Feature | Status |
|---------|--------|
| OAuth2 login with pred.gg (PKCE) | ✅ Complete |
| Player search & profile sync | ✅ Complete |
| Full match history (all game modes, 50 matches) | ✅ Complete |
| Persistent sessions (30-day auto-refresh) | ✅ Complete |
| Dashboard with data sync controls | ✅ Complete |
| Team analysis (roster view) | ⚙️ Stub — expanding next |
| Pre-scrim report generation | ⚙️ Basic |
| Teams management UI (create/edit rosters) | 🔜 Next |
| Build / stat calculator | 📋 Planned (Phase 2) |

**93% competitive match data coverage** confirmed against pred.gg GraphQL API.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Domain engine | `packages/domain-engine` (pure TS) |
| Auth | OAuth2 PKCE + HTTP-only cookie sessions (30-day refresh) |
| Database | PostgreSQL + Prisma ORM |
| Tests | Vitest + Supertest (43 tests) |
| Monorepo | npm workspaces |
| Data source | pred.gg GraphQL API (OAuth2 PKCE) |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your credentials
cp .env.example .env
# Edit .env: add PRED_GG_CLIENT_ID, PRED_GG_CLIENT_SECRET, DATABASE_URL

# 3. Start PostgreSQL and apply schema
sudo service postgresql start
npm run db:migrate --workspace=@predecessor/data-sync

# 4. Start both services (dev mode with hot reload)
./serve.sh start

# 5. Open the app and log in with pred.gg
open http://localhost:5173
```

## Project structure

```
apps/
  api/          → Express backend (auth, players, teams, reports, admin, patches)
  web/          → React frontend (Dashboard, PlayerScouting, TeamAnalysis, ScrimReport)
packages/
  data-model/   → Shared TypeScript types and DTOs
  domain-engine → Build/stat calculation engine (future phase)
workers/
  data-sync/    → pred.gg data ingestion (players, matches, versions)
    prisma/     → Database schema and migrations
scripts/
  explore_predgg_api.py           → OAuth2 diagnostic tool
  explore_predgg_authenticated.py → Authenticated API inventory generator
docs/
  planning.md                     → Active tasks and status ← read first
  project_predecessor.md          → Product spec and roadmap
  predecessor_api_technical_doc.md → pred.gg API integration reference
  predgg_api_inventory.md         → Full authenticated API query/field inventory
  future_features_roadmap.md      → Backlog with priorities
  workflow.md                     → Git and PR development workflow
  data_quality_policy.md          → Data freshness and sync strategy
```

## Data source

- **pred.gg GraphQL** (`https://pred.gg/gql`) — players, matches, teams, patches, hero stats
- OAuth2 PKCE required for player search/stats; heroes, items, versions are public
- Register at [pred.saibotu.de](https://pred.saibotu.de) to obtain application credentials
- See [docs/predgg_api_inventory.md](docs/predgg_api_inventory.md) for full API coverage

## Delivery roadmap

| Phase | Deliverable | State |
|-------|-------------|-------|
| 1 | Data ingestion + normalized schema + player scouting | ✅ Complete |
| 2 | Scouting dashboards + rival reports + scrim prep | ✅ Complete (basic) |
| 3 | Teams management UI + enriched match timeline data | 🔜 In progress |
| 4 | Build/stat calculator (level/items/skills) | 📋 Planned |
| 5 | Draft support + advanced recommendations | 📋 Planned |

## Service management

```bash
./serve.sh start              # dev mode (tsx watch + vite, hot reload)
./serve.sh start --prod       # build frontend then run production servers
./serve.sh stop
./serve.sh restart [--dev|--prod]
./serve.sh status
./serve.sh logs [api|web]
```
