# RiftLine — Competitive Intel for Predecessor

Private competitive intelligence platform for the MOBA [Predecessor](https://www.predecessorgame.com/). Built for coaches, analysts, and players to scout rivals, track performance, and prepare with real match data.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express + Node.js + TypeScript |
| Database | PostgreSQL 16 + TimescaleDB 2.27 + Prisma ORM |
| Auth | Internal (bcrypt + JWT + HTTP-only cookies) + OAuth2 PKCE (pred.gg) |
| Logging | Pino (structured JSON) |
| Tests | Vitest + Supertest (151 tests) |
| CI/CD | GitHub Actions + branch protection on main |
| Hosting | Hetzner VPS (Nginx + PM2; API + frontend static build) |

---

## Features

### Analysis
- **Player Scouting** — profile, hero pool, WR trends, form strip, CS/wards/multi-kills, advanced metrics (Gold/Damage/Kill Share, Efficiency Gap, Death Rates)
- **Team Analysis** — roster, performance by patch/side, Phase/Vision/Objective/Draft Analysis, Rival Scouting with threat score
- **Match Detail** — Scoreboard, Statistics (16 extended fields), Timeline (swim lanes + minimap), Analysis (Objective Control, Gold Diff, Heatmap)
- **Analyst Rules Engine** — 9 deterministic rules: critical deaths pre-objective, vision gaps, throw patterns, player slump, draft dependency, positive reinforcement

### Team Tools
- **Review Queue** — 8 states, 8 cause tags, inline edit, priority filters
- **Team & Player Goals** — KPI strips, progress tracking
- **Battle Plan** (Scrim Report) — VS view, win conditions, ban targets, Full Screen mode for projection
- **VOD & Replay Index** — external video links with timestamps and filters

### Platform
- **RBAC** — roles: `PLATFORM_ADMIN`, `MANAGER`, `COACH`, `ANALISTA`, `JUGADOR`, `PLAYER`
- **View As Role** — admins preview UI as any role (sessionStorage, no DB change)
- **Player self-linking** — players link their pred.gg profile from the Dashboard
- **Platform Admin panel** — Staff management, Data Controls, Audit Logs
- **Data retention** — configurable global window with permanent preservation for linked players and team rosters
- **Landing page** — hero showcase with Predecessor characters
- **Login fullscreen** — internal email/password; social logins (coming soon)

---

## Local setup

### Prerequisites
- Node.js 20.12+
- Docker with Compose, or PostgreSQL 16 with TimescaleDB 2.27+
- npm 10+

### Install
```bash
git clone https://github.com/saggacce/Predecessor-Build
cd Predecessor-Build
npm install
```

### Configure
```bash
cp .env.example .env
# Fill in DATABASE_URL and PRED_GG_* credentials
```

### Database
```bash
docker compose -f docker-compose.database.yml up -d
npx prisma migrate deploy --schema workers/data-sync/prisma/schema.prisma
npx prisma generate --schema workers/data-sync/prisma/schema.prisma
npx tsx scripts/seed-config.ts             # seed platform config
```

### Run (development)
```bash
./serve.sh start            # API on :3001, frontend on :5173
./serve.sh logs             # tail both logs
./serve.sh stop
```

### Tests
```bash
npm test                    # 151 tests across API routes + domain engine
npm run typecheck           # TypeScript strict check
```

---

## Project structure

```
apps/
  api/          Express API + sync service
  web/          React frontend (Vite)
packages/
  data-model/   Shared TypeScript types (DTOs)
  domain-engine/ Pure TS business logic (no I/O)
workers/
  data-sync/    Prisma schema + CLI sync worker
scripts/
  seed-config.ts  Platform config seed
  seed-qa.ts      QA test data (dev only — run with --clean to remove)
docs/           Technical and product documentation
assets/         Static assets (heroes, items, icons, ranks, maps)
```

---

## Key docs

| Doc | Purpose |
|-----|---------|
| `docs/planning.md` | Active tasks and project state |
| `docs/future_features_roadmap.md` | Prioritized feature backlog |
| `docs/react_crash_patterns.md` | React crash diagnosis and prevention |
| `docs/primesight_visual_design_direction.md` | UI design system reference |
| `docs/primesight_indicators_catalog.csv` | Full metrics catalog |
| `docs/predgg_api_inventory.md` | pred.gg GraphQL field reference |
| `docs/workflow.md` | Git workflow and conventions |

---

## Data retention

Unowned match data is retained for **3 months** by default. Matches involving a player linked to a user account or team roster are preserved for longitudinal coaching. Personal imports use a separate **60-month** window by default. Configure these with `DATA_RETENTION_MONTHS` and `PERSONAL_HISTORY_MONTHS`. A cleanup job runs on the 1st of each month at 03:00 AM; manual trigger: `POST /admin/cleanup-old-data`.

Kills, objectives, structures, wards, and transactions are stored as hypertables with seven-day chunks and automatic compression after 30 days. Local build, matchup, and personal interval aggregates refresh daily and can be rebuilt with `POST /admin/refresh-coach-aggregates`.
