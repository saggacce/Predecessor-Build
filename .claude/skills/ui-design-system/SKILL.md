---
name: ui-design-system
description: Load for any UI change — pages, CSS, components, colors, icons. Contains PrimeSight design tokens and rules.
---

# PrimeSight UI Design System

## Semantic colors (CSS variables — `apps/web/src/index.css`)
| Variable | Value | Semantic use |
|----------|-------|-------------|
| `--accent-blue` | `#5b9cf6` | Primary CTA, analysis actions, buttons, focus rings |
| `--accent-teal-bright` | `#38d4c8` | Navigation active state, scouting, vision contexts |
| `--accent-prime` | `#f0b429` | Objectives, gold, Prime — also carry role color |
| `--accent-violet` | `#a78bfa` | Rank, draft, intelligence — also midlane role color |
| `--accent-win` | `#4ade80` | Win / improvement — never use for anything else |
| `--accent-loss` | `#f87171` | Loss / risk — never use for anything else — also offlane role |
| `--bg-card` | `#1e2330` | Card and panel backgrounds |
| `--bg-panel` | `#111318` | Sidebar, secondary panels |
| `--bg-dark` | `#0a0c10` | Page background |
| `--border-color` | `rgba(255,255,255,0.07)` | Default borders |
| `--text-primary` | `#e2e8f0` | Main text |
| `--text-secondary` | `#94a3b8` | Secondary text |
| `--text-muted` | `#64748b` | Labels, metadata |

## Role colors (consistent across ALL pages)
| Role | Color | Variable |
|------|-------|----------|
| carry | `#f0b429` | `--accent-prime` |
| jungle | `#7fd66b` | — |
| midlane | `#a78bfa` | `--accent-violet` |
| offlane | `#f87171` | `--accent-loss` |
| support | `#38d4c8` | `--accent-teal-bright` |

## Team identity colors
- **OWN team:** teal `var(--accent-teal-bright)`
- **RIVAL team:** loss red `var(--accent-loss)`

## Typography rules
- Body font: `DM Sans` (primary) loaded from Google Fonts in `apps/web/index.html`
- Mono font: `JetBrains Mono` — **apply to ALL numeric values without exception**
  - Includes: KDA, WR%, GPM, VP, timestamps, match counts, IDs, gold values
  - CSS: `fontFamily: 'var(--font-mono)'`
  - Utility class: `.mono` in `index.css`
  - Enable tabular numbers: `fontVariantNumeric: 'tabular-nums'`

## Component conventions
- Stat labels: uppercase, `color: var(--text-muted)`, `fontSize: '0.75rem'`, `letterSpacing: '0.05em'`
- Stat values: mono font, larger size than label
- Cards: `.glass-card` CSS class
- Colored indicator stripe: `width: 3px, borderRadius: 999px` left border on card headers
- Buttons primary: `.btn-primary` class (blue gradient `#6baaf8 → #4a85e0`)
- Loading skeleton: shimmer on `#1e2330` background
