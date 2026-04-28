# Future Features Roadmap (iTero-like capabilities for Predecessor)

This document tracks high-impact capabilities not included in the current safe scope.

Priority legend:
- P0: critical for competitive workflow
- P1: high-value optimization
- P2: medium-term enhancement
- P3: long-term/experimental

Difficulty legend:
- Low / Medium / High / Very High

---

## 1. Real-time draft assistant (advanced)
- **Priority:** P0
- **Difficulty:** High
- **Estimated time:** 8–12 weeks
- **What it is:** live drafting recommendations combining comfort picks, counters, role-flex, and patch trends.
- **What is needed:**
  - Reliable near-real-time data pipeline.
  - Draft-state model and recommendation engine.
  - Confidence scoring and explanation layer.
  - Sufficient historical match dataset by patch.

## 2. Team-vs-team scrim prep auto-reports
- **Priority:** P0
- **Difficulty:** Medium
- **Estimated time:** 4–6 weeks
- **What it is:** one-click pre-scrim reports with key picks, role tendencies, weak windows, and ban targets.
- **What is needed:**
  - Stable team aggregation logic.
  - Report templates and export/share system.
  - Patch-aware filters and freshness metadata.

## 3. Opponent strategy fingerprinting
- **Priority:** P1
- **Difficulty:** High
- **Estimated time:** 6–10 weeks
- **What it is:** classify team style archetypes (early pressure, objective control, scaling, etc.).
- **What is needed:**
  - Feature engineering on match timelines/events.
  - Clustering/classification pipeline.
  - Validation framework with analyst feedback.

## 4. Post-match coaching insights
- **Priority:** P1
- **Difficulty:** High
- **Estimated time:** 6–10 weeks
- **What it is:** structured recommendations after matches with trend deviations and actionable improvements.
- **What is needed:**
  - Baseline-vs-actual comparison models.
  - Alerting rules and explanation UI.
  - Continuous tuning with real team usage.

## 5. Build intelligence with scenario simulation
- **Priority:** P1
- **Difficulty:** Medium
- **Estimated time:** 5–8 weeks
- **What it is:** build/stat simulator by level, abilities, items, and optional enemy context.
- **What is needed:**
  - Deterministic stat engine.
  - Item/passive logic coverage and versioning.
  - Explainable output panels.

## 6. Live in-game overlays (timers/trackers)
- **Priority:** P2
- **Difficulty:** Very High
- **Estimated time:** 10–16+ weeks
- **What it is:** overlays for objective timers, economy cues, and tactical reminders.
- **What is needed:**
  - Platform/legal compliance validation.
  - Safe and reliable telemetry capture path.
  - Performance-safe desktop integration.

## 7. Automated draft plan generator (bo3/bo5)
- **Priority:** P2
- **Difficulty:** High
- **Estimated time:** 8–12 weeks
- **What it is:** scenario trees for multi-game series with ban/pick adaptation plans.
- **What is needed:**
  - Series-level simulation engine.
  - Adaptation logic from game-to-game outcomes.
  - Staff workflow and UI for plan editing.

## 8. Alerting and monitoring center
- **Priority:** P2
- **Difficulty:** Medium
- **Estimated time:** 3–5 weeks
- **What it is:** alerts when rival picks shift, role swaps appear, or performance drops rise.
- **What is needed:**
  - Change-detection thresholds.
  - Notification channels.
  - Audit logs and false-positive controls.

## 9. AI-assisted report narrative
- **Priority:** P3
- **Difficulty:** Medium
- **Estimated time:** 3–6 weeks
- **What it is:** auto-generated narrative summaries from structured scouting data.
- **What is needed:**
  - Prompt templates and guardrails.
  - Fact-linking to metrics for traceability.
  - Human review workflow.

## 10. Organization-level multi-team workspace
- **Priority:** P3
- **Difficulty:** Medium
- **Estimated time:** 4–7 weeks
- **What it is:** support multiple squads/staff permissions and shared scouting libraries.
- **What is needed:**
  - RBAC and tenancy model.
  - Shared storage and governance.
  - Audit and access reporting.

---

## Safe-now implementation guidance
Given current repository state (docs + API exploration scripts), the safest immediate path is:
1. Build ingestion + normalized schema.
2. Deliver player and team scouting dashboards.
3. Add report exports for scrim prep.
4. Defer overlay/live automation until data/compliance constraints are validated.
