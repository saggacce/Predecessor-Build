# Predecessor Competitive Intelligence Platform
## Technical project document for software development

Prepared in English for engineering, product, and design alignment.

---

## 1. Product vision
Build a web-based competitive intelligence tool for Predecessor to support teams with:

1. Player tracking and performance monitoring.
2. Rival scouting for scrims and official matches.
3. Team-level analysis for draft and strategic preparation.
4. Build/stat simulation as a second-stage capability.

The product should prioritize real coaching and prep workflows before build calculators.

---

## 2. Design principles
- Explainable over opaque: every metric should be traceable.
- Competitive usefulness first: outputs should help pre-match decisions.
- Phased delivery: scouting first, build simulation later.
- Data normalization boundary: external APIs are dependencies, not internal contracts.
- Conservative recommendation style: confidence-rated guidance, not deterministic promises.

---

## 3. Scope
### In scope for initial release
- Player profile and trend tracking.
- Rival player scouting cards.
- Team tendency analysis (composition, picks, bans, patch splits).
- Scrim/pre-match report generation.
- Data sync and patch-aware versioning.

### Out of scope for initial release
- Real-time in-game overlay automation.
- Full replay parsing and timeline reconstruction.
- Guaranteed draft winner prediction.
- Fully automated coaching without analyst review.

---

## 4. Primary user stories
- Analyst: monitor own players by role, hero pool, and trend over time.
- Coach: generate opponent scouting report before scrims.
- Manager: compare candidates and identify fit risks.
- Team staff: review team-level tendencies and exploitable patterns.

---

## 5. Functional requirements (scouting-first)
- FR-01: Track player performance by patch, queue, role, and hero.
- FR-02: Show trend windows (last N matches, last 7/30 days).
- FR-03: Provide rival scouting profile with comfort picks and volatility.
- FR-04: Aggregate team-level tendencies from player/match data.
- FR-05: Generate explainable pre-scrim and pre-match reports.
- FR-06: Support filtering by version/patch and surface data freshness.
- FR-07: Keep formulas and scoring explainable in the UI/API.
- FR-08: Persist and share report snapshots.

---

## 6. Scouting engine requirements
The scouting engine should be a pure and testable module.

### Inputs
- Player IDs and team IDs.
- Match history windows.
- Patch/version filters.
- Role and hero filters.

### Outputs
- Player profile metrics (consistency, form, hero concentration, role distribution).
- Team profile metrics (draft identity, comfort dependence, matchup sensitivity).
- Risk flags and confidence level.
- Report-ready summaries.

### Implementation notes
- Deterministic, pure functions.
- Version-aware calculations.
- Explicit unsupported-feature flags (no hidden assumptions).

---

## 7. Build/stat module (secondary phase)
After scouting is stable, add:
- Hero stat scaling by level.
- Skill order and item order impact.
- Build comparison with explainable stat deltas.
- Spike/timing summaries.

---

## 8. Proposed architecture
- Frontend application: React + TypeScript.
- Backend application: Node.js + TypeScript.
- Scouting engine: shared TypeScript package.
- Build/stat engine: shared TypeScript package (later phase).
- Database: PostgreSQL.
- Cache layer: Redis.
- Scheduled sync worker: external data ingestion and normalization.

### Recommended module split
- `apps/web` — user-facing scouting and reporting frontend.
- `apps/api` — backend API.
- `packages/scouting-engine` — scouting metrics and scoring.
- `packages/domain-engine` — build/stat logic (later phase).
- `packages/data-model` — shared types and DTOs.
- `workers/data-sync` — ingestion and normalization.

---

## 9. Suggested backend endpoints
- `GET /players/:id/profile`
- `POST /players/compare`
- `GET /teams/:id/profile`
- `POST /reports/scrim`
- `POST /reports/match-prep`
- `GET /patches/latest`
- `POST /builds/calculate` (later phase)

---

## 10. Non-functional requirements
- Deterministic scoring.
- Patch-version awareness and reproducibility.
- Graceful degradation when external APIs fail.
- Strong typing across contracts.
- Interactive response times for staff workflows.

---

## 11. Testing strategy
Required automated tests:
- Unit tests for scouting metric aggregation.
- Unit tests for trend windows and filters.
- Unit tests for scoring and confidence bands.
- Snapshot tests for representative player/team profiles.
- Regression tests across patch versions.

Manual QA:
- Cross-check sample outputs with trusted data sources.
- Validate edge cases for low-sample players.
- Validate role-swaps and patch transitions.

---

## 12. Delivery roadmap
| Phase | Deliverable |
|---|---|
| 1 | Data ingestion + normalized schema + scouting engine foundation |
| 2 | Player/team scouting dashboards + report generation |
| 3 | Draft-support recommendations (explainable) |
| 4 | Build/stat calculator module |
| 5 | Advanced intelligence and recommendation refinement |

---

## 13. Risks and mitigations
- External API drift → strict normalization layer and sync audits.
- Sparse sample bias → confidence flags and minimum sample thresholds.
- Misleading recommendations → explainable scoring + analyst override.
- Patch drift → version all synced data and expose active patch in UI.

---

## 14. MVP acceptance criteria
- Staff can track own players with trend windows.
- Staff can generate rival scouting summaries.
- Staff can analyze team-level tendencies.
- Reports are shareable and patch-aware.
- Scouting engine has reliable automated test coverage.
