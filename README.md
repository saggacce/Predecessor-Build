# PrimeSight — Competitive Intelligence for Predecessor

Private web platform for competitive analysis of the MOBA game [Predecessor](https://www.predecessorgame.com/). Built for coaches and analysts to scout rivals, manage rosters, and prepare scrims with real match data.

## Current state

| Feature | Status |
|---------|--------|
| OAuth2 login with pred.gg (PKCE, 30-day sessions) | ✅ Complete |
| Player search, profile sync, match history | ✅ Complete |
| Player Scouting UI (10-phase state machine) | ✅ Complete |
| Dashboard with data sync controls | ✅ Complete |
| CI/CD (GitHub Actions + branch protection) | ✅ Complete |
| **Teams management — create, edit, roster CRUD** | ✅ Complete |
| PrimeSight design system (color, typography, favicon) | ✅ Complete |
| Competitive docs (indicators catalog, design direction) | ✅ Complete |
| Team logo upload | 🔜 Next |
| Custom names for players without pred.gg accounts | 🔜 Next |
| Event stream sync (heatmaps, Fase 2 metrics) | 🔜 Planned |
| Pre-scrim report (enriched) | 🔜 Planned |
| Build / stat calculator | 📋 Phase 2+ |

**93% competitive match data coverage** confirmed against pred.gg GraphQL API, including event stream (heroKills with X/Y/Z coordinates, ward placements, gold timeline, item purchase timestamps).

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
| Data source | pred.gg GraphQL API |
| Logging | Pino (JSON structured, credential redaction) |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in credentials
cp .env.example .env
# Edit .env: PRED_GG_CLIENT_ID, PRED_GG_CLIENT_SECRET, DATABASE_URL, SESSION_SECRET

# 3. Start PostgreSQL and apply schema
sudo service postgresql start
npm run db:migrate --workspace=@predecessor/data-sync

# 4. Start both services (hot reload)
./serve.sh start

# 5. Open the app and log in with pred.gg
open http://localhost:5173
```

## Project structure

```
apps/
  api/          → Express backend (auth, players, teams, reports, admin, patches)
  web/          → React frontend (Dashboard, PlayerScouting, TeamAnalysis, ScrimReport)
assets/
  heroes/       → 129 hero portraits and promo images (.webp)
  items/        → 321 item icons (.webp)
  icons/roles/  → Role icons: carry, jungle, midlane, offlane, support (.png)
  maps/         → map.png (3-lane), brawl_map.png (Arena)
packages/
  data-model/   → Shared TypeScript DTOs
  domain-engine → Stat calculation engine (Phase 2)
workers/
  data-sync/    → pred.gg data ingestion (players, matches, versions, Prisma schema)
scripts/
  explore_predgg_api.py           → OAuth2 diagnostic tool
  explore_predgg_authenticated.py → Regenerate predgg_api_inventory.md
docs/
  planning.md                          → Active tasks ← read first
  primesight_visual_design_direction.md → Full design system and UX spec
  primesight_indicators_catalog.csv    → 102 competitive metrics with implementation phases
  project_predecessor.md               → Product specification
  predecessor_api_technical_doc.md     → pred.gg API integration reference
  predgg_api_inventory.md              → Full GraphQL field inventory (authenticated)
  future_features_roadmap.md           → Feature backlog P0–P3
  workflow.md                          → Git and PR workflow
  data_quality_policy.md               → Data freshness and sync strategy
  portal-moba-analytics.html           → MOBA analytics market research (reference)
```

## Data source

- **pred.gg GraphQL** (`https://pred.gg/gql`) — players, matches, teams, patches, assets
- OAuth2 PKCE required for player search and event stream data
- Heroes, items, versions, ratings are public (no auth)
- See [docs/predgg_api_inventory.md](docs/predgg_api_inventory.md) for full coverage details

## pred.gg event stream (confirmed available)

| Data | Fields |
|------|--------|
| `heroKills` | gameTime, location {x,y,z}, killer/killed player+hero+team |
| `objectiveKills` | gameTime, killedEntityType (FANGTOOTH, ORB_PRIME…), killerTeam |
| `structureDestructions` | gameTime, structureEntityType, destructionTeam, location |
| `wardPlacements/Destructions` | gameTime, type (STEALTH/ORACLE/SENTRY/…), location |
| `goldEarnedAtInterval` | Cumulative gold per minute (array, 1 value/min per player) |
| `transactions` | gameTime, transactionType (BUY/SELL/UNDO…), itemData |
| `heroBans` | hero + team — **RANKED only, no pick order** |

All event data requires a valid pred.gg Bearer token.

## Service management

```bash
./serve.sh start              # dev mode (tsx watch + vite, hot reload)
./serve.sh start --prod       # production build then serve
./serve.sh stop
./serve.sh restart [--dev|--prod]
./serve.sh status
./serve.sh logs [api|web]
```

## Delivery roadmap

| Phase | Deliverable | State |
|-------|-------------|-------|
| 1 | Data ingestion + normalized schema + player scouting | ✅ Complete |
| 2 | Teams management + PrimeSight design system | ✅ Complete |
| 3 | Event stream sync + heatmaps + Fase 2 metrics | 🔜 In progress |
| 4 | Draft analysis + comfort scores + ban vulnerability | 📋 Planned |
| 5 | Build/stat calculator (level/items/skills) | 📋 Planned |
