Predecessor Build Planner & Matchup
Evaluator
Technical project document for software development
Prepared in English for engineering, product, and design alignment

Project type
Audience
Document intent
Product + technical
specification
Developers / technical lead
Define scope, architecture,
rules, and phased delivery


Context
The product should allow users to create and compare hero builds for Predecessor, visualize how hero stats and abilities scale through a build, and later estimate matchup advantage between two heroes/builds using transparent, explainable scoring rather than a fake deterministic winner prediction.


1. Product vision
Build a web-based analysis tool for Predecessor that helps players understand itemization, skill progression, stat growth, and matchup implications. The first release should focus on trustworthy build analysis. Matchup prediction should be introduced only after the stat and damage model is stable.
Core product outcomes
• Users can select a hero, level, role, build order, and skill order, then see final and intermediate stats.
• Users can compare two builds of the same hero and understand their trade-offs.
• Users can later compare two heroes/builds and receive an explainable matchup advantage report.
• Developers can maintain the rules engine without constantly changing UI code.
2. Design principles
• Explainable over magical. Every number shown to the user should be traceable to base stats, scaling, items, passives, or calculation rules.
• Phased delivery. Do not start with a full winner predictor. Start with a build engine, then comparison, then probabilistic matchup evaluation.
• Data-driven architecture. Hero, item, and ability logic should be sourced from structured external data where possible and normalized internally.
• Separation of concerns. Keep ingestion, calculations, API, and frontend presentation isolated so the rules engine can evolve safely.
• Competitive usefulness. Outputs should reflect practical decisions: spikes, burst windows, survivability, damage profile, and build identity.
3. Scope
In scope for version 1
• Hero build planner
• Item selection and ordered build paths
• Skill order selection
• Level-based stat calculator
• Derived combat metrics (burst, DPS, effective health, sustain-related indicators where possible)
• Same-hero build comparison
• Saved/shared build links
• Admin/update pipeline for synced game data
Out of scope for version 1
• Full replay analysis
• Live match telemetry
• Teamfight simulation
• Patch-note auto-interpretation
• Guaranteed winner prediction between any two heroes
4. Assumptions and external data
The tool is expected to use Pred.gg as the main external data source because it exposes game resources through its API and already structures information around heroes, items, builds, skill priority, and player/game statistics. This should be treated as a dependency that may evolve, so the internal system must not couple frontend logic directly to the external schema.
Required external data domains
• Hero identity, role tags, base stats, and per-level stat growth
• Abilities, level scaling, cooldowns, costs, and relevant coefficient values
• Items, flat stats, percentage stats, passive effects, conditional effects, and tags
• Optional popularity/win-rate metadata for future recommendations
Data dependency policy
• Ingest external data into an internal normalized schema.
• Version the imported data by patch or sync timestamp.
• Add a fallback cache so the app remains usable if the external source is temporarily unavailable.
5. Primary user stories
Player: Build a hero and inspect stat changes at key levels to understand spikes.
Player: Compare two builds on the same hero to choose between burst, durability, or sustained damage.
Player: Compare one hero/build against another and understand likely matchup strengths and weaknesses.
Coach / analyst: See transparent formulas and assumptions to trust the outputs.
Admin: Resync hero and item data when game patches change.
6. Functional requirements
• FR-01: The system must allow hero selection, role selection, level selection, and build order selection.
• FR-02: The system must support manual and template-based skill order selection.
• FR-03: The calculator must output base stats, bonus stats, final stats, and calculated secondary metrics at each selected level.
• FR-04: The UI must show incremental changes after each item purchase and after each ability rank milestone.
• FR-05: The comparison view must support at minimum: build A vs build B for the same hero.
• FR-06: The system should support future hero-vs-hero comparison without redesigning the data model.
• FR-07: The app must expose calculation explanations or formula tooltips for major displayed values.
• FR-08: The system must support build persistence by shareable URL and database-backed saved builds.
7. Calculation engine requirements
The calculation engine is the core of the product. It should be implemented as a pure, testable domain module with no frontend dependencies.
Inputs
• Hero identifier
• Role context (if role-specific assumptions are applied later)
• Level
• Build item list in order
• Skill order / current ability ranks
• Optional enemy defensive stats for effective damage views
Outputs
• Final stat block
• Ability damage values by rank and total scaling contribution
• Burst window metrics (example: 2-second or combo-based output)
• Sustained damage metrics (example: 5-second or 10-second window)
• Effective health estimates versus physical and magical damage
• Build spike summary after each item
Implementation notes
• Use deterministic pure functions.
• Represent stats in structured categories: base, bonus, final, percent modifiers, temporary modifiers.
• Model item passives separately from raw stats so rules remain maintainable.
• Allow feature flags for unsupported passive logic instead of silently faking values.
8. Matchup evaluator requirements
This feature should be delivered only after the build/stat calculator is stable. The first version should produce an explainable matchup advantage report, not a hard claim that one hero always wins.
Recommended output dimensions
• Burst advantage
• Sustained DPS advantage
• Durability / effective health advantage
• Mobility / gap-close / disengage advantage
• Crowd control pressure
• Lane or duel window timing by level/item spike
• Risk notes and assumption notes
Recommended output style
• Score each category on a bounded scale.
• Show weighted overall advantage as a probability band or confidence-rated recommendation.
• State assumptions clearly: equal gold, equal level, ideal combo execution, no third-party interference, etc.
9. Proposed scoring model for early matchup evaluation
Initial matchup scoring should be transparent and deliberately conservative.
Dimension
Weight
Example basis
Output
Burst
25%
Combo damage inside short combat window after mitigation
Score
Sustained DPS
20%
Expected repeated damage over defined time window
Score
Durability
20%
Effective health + shields + mitigation availability
Score
Utility
15%
CC, peel, chase, disengage, range pressure
Score
Tempo / spikes
20%
How early the build becomes threatening and how stable it remains
Score

The final weighted result should be described as an estimate, not a truth statement. Example phrasing: 'Build A appears favored in short trades after item 3, but Build B has a stronger extended-fight profile.'
10. System architecture
• Frontend application: React + TypeScript
• Backend application: Node.js + TypeScript
• Domain engine: shared TypeScript package with stat and matchup logic
• Database: PostgreSQL
• Cache layer: Redis (optional for build snapshots, external API caching, or sync jobs)
• Scheduled sync worker: imports and normalizes external game data
Recommended module split
• apps/web - user-facing frontend
• apps/api - backend API service
• packages/domain-engine - calculation rules
• packages/data-model - shared types and DTOs
• workers/data-sync - Pred.gg ingestion and normalization
11. Data model
Below is a practical starting model. It is intentionally normalized enough for maintainability without trying to represent every future feature on day one.
Entity
Key fields
Purpose
Hero
id, name, roles, tags, patchVersion
Core hero identity
HeroStatProfile
heroId, base stats, per-level growth
Progression inputs
Ability
id, heroId, slot, scaling schema
Ability metadata
Item
id, name, tags, cost
Core item identity
ItemEffect
itemId, type, stat/effect payload
Passive and active logic
Build
id, heroId, role, item order, skill order
Saved user build
BuildSnapshot
buildId, level, final stats, derived metrics
Cached outputs
PatchSync
id, sourceVersion, syncedAt, status
Data auditability

12. Backend API design
Suggested endpoints or GraphQL operations
• GET /heroes
• GET /heroes/:id
• GET /items
• POST /builds/calculate
• POST /builds/compare
• POST /matchups/evaluate
• POST /admin/sync-data
• GET /patches/latest
Whether the public app API is REST or GraphQL is less important than keeping the domain engine independent. The backend should call the domain engine and return structured results plus explanations.
13. Frontend requirements
• Fast hero and item selection UX
• Clear build order UI
• Visible per-level and per-item stat changes
• Tabbed views for overview, raw stats, abilities, timeline, and comparison
• Formula/explanation tooltips
• Responsive layout for desktop first, tablet second, mobile optional for MVP
Main screens
• Hero build planner
• Build comparison
• Matchup analysis
• Saved builds library
• Admin sync/status panel (internal only)
14. Non-functional requirements
• Deterministic calculations
• Good test coverage on all formulas and passive interactions
• Patch-version awareness and reproducibility
• Graceful degradation when external sync is unavailable
• Strong typing across backend and frontend data contracts
• Response times suitable for interactive use
15. Testing strategy
Required automated tests
• Unit tests for stat aggregation
• Unit tests for level scaling
• Unit tests for ability damage calculations
• Unit tests for item effect stacking and exclusion rules
• Snapshot tests for representative hero builds
• Regression tests across patch versions if formulas or data change
Manual QA
• Cross-check sample outputs against in-game values where practical
• Validate hero/item edge cases
• Verify same-hero comparison is numerically consistent
• Verify unsupported passives are surfaced, not hidden
16. Delivery roadmap
Phase
Deliverable
Phase 1
Data ingestion + normalized schema + stat calculator foundation
Phase 2
Build planner UI + per-level/per-item breakdown
Phase 3
Same-hero build comparison
Phase 4
First matchup evaluator with explainable weighted scoring
Phase 5
Refinement, patch handling, saved builds, recommendation helpers

17. Risks and mitigations
External API changes: Hide the source behind an internal normalized data layer and sync jobs.
Complex passives and exceptions: Implement support incrementally and flag unsupported logic explicitly.
Misleading matchup outputs: Use explainable weighted models and assumption labels instead of hard winner claims.
Patch drift: Version all synced data and expose the current patch in the UI.
Overengineering too early: Ship the calculator first; do not start with a full simulation engine.
18. Acceptance criteria for MVP
• A developer can sync hero, item, and ability data into the internal schema.
• A user can create a build for a hero and select a level.
• The app returns final stats and ability values for that state.
• The UI clearly shows power spikes by item and level.
• The app can compare two builds of the same hero with trusted outputs.
• The calculation engine has test coverage for representative heroes and item combinations.
19. Final implementation recommendation
Start with a reliable build and stat engine. Treat matchup prediction as a second-stage capability built on top of verified formulas. If the first milestone is trustworthy, the rest of the product becomes much easier to scale, explain, and maintain.
