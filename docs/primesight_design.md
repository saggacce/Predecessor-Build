---
name: PrimeSight
description: >-
  Dark-first competitive intelligence platform for MOBA coaching and analysis.
  Built around a glassmorphism card system, game-adjacent color semantics,
  and strict mono-font data display. The aesthetic is professional analytical
  tool with esports depth: dark surfaces, subtle luminous accents, diagonal
  lane geometry on backgrounds, and role/team color conventions inherited from
  the game itself.

# ── Single source of truth for all design decisions ──────────────────────────
# Token names map 1:1 to CSS custom properties in apps/web/src/index.css
# Component class names map 1:1 to apps/web/src/App.css + index.css

colors:
  # ── Backgrounds (dark-first, four elevation levels) ───────────────────────
  bg-page:    "#0a0c10"        # canvas — the darkest surface, body background
  bg-panel:   "#111318"        # sidebar, secondary panels, inset areas
  bg-card:    "#1e2330"        # primary card surface
  bg-elevated: "#252c3a"       # elevated cards, dropdowns, hover states, tooltips
  bg-hover:    "#252c3a"       # alias of bg-elevated — used for row hover, list hover

  # ── Text ramp (four tiers) ────────────────────────────────────────────────
  text-primary:   "#e2e8f0"    # headings, active labels, primary data values
  text-secondary: "#94a3b8"    # body text, descriptions, inactive labels
  text-muted:     "#64748b"    # metadata, units, column headers (uppercase)
  text-dim:       "#475569"    # disabled state, ghost placeholders, fine print

  # ── Semantic accents ──────────────────────────────────────────────────────
  # Blue — primary action: CTAs, buttons, focus rings, active analysis
  accent-blue:    "#5b9cf6"
  accent-blue-2:  "#3d7de4"    # darker shade for gradients, pressed states

  # Teal — vision, scouting, navigation active, map/ward context
  accent-teal:        "#14b8a6"
  accent-teal-bright: "#38d4c8" # nav active state, connected indicator, support role

  # Violet — rank, draft intelligence, midlane role
  accent-violet: "#a78bfa"

  # Prime/Gold — objectives, macro events, gold data, carry role
  accent-prime: "#f0b429"

  # Semantic win/loss/warn
  accent-win:  "#4ade80"       # positive trend, victory, green metric
  accent-loss: "#f87171"       # negative trend, defeat, risk, offlane role
  accent-warn: "#f0b429"       # alias of prime — threshold warnings

  # ── Borders ───────────────────────────────────────────────────────────────
  border-default:    "rgba(255, 255, 255, 0.07)"   # cards, dividers, inputs at rest
  border-strong:     "rgba(255, 255, 255, 0.12)"   # card hover, elevated state
  border-highlight:  "rgba(91, 156, 246, 0.45)"    # blue focus ring on inputs
  border-teal:       "rgba(56, 212, 200, 0.28)"    # nav active link, scouting context

  # ── Shadows ───────────────────────────────────────────────────────────────
  shadow-card: "0 4px 24px rgba(0, 0, 0, 0.28)"
  shadow-neon: "0 0 0 1px rgba(91, 156, 246, 0.18), 0 16px 44px rgba(0, 0, 0, 0.34)"
  shadow-focus: "0 0 0 3px rgba(91, 156, 246, 0.1)"   # input focus ring

  # ── Role colors (game roles — consistent across ALL pages) ────────────────
  role-carry:   "#f0b429"    # same as accent-prime — gold/objective feel
  role-jungle:  "#7fd66b"    # bright green — unique role identifier
  role-midlane: "#a78bfa"    # same as accent-violet
  role-offlane: "#f87171"    # same as accent-loss — aggressive/tanky read
  role-support: "#38d4c8"    # same as accent-teal-bright — vision/utility feel

  # ── Team identity ─────────────────────────────────────────────────────────
  team-own:   "#38d4c8"      # DUSK side — teal (our team)
  team-rival: "#f87171"      # DAWN side — loss red (opponent)

  # ── Severity levels (Analyst Rules Engine, Review Queue) ─────────────────
  severity-critical: "#f87171"   # accent-loss — immediate attention required
  severity-high:     "#f0b429"   # accent-prime — significant issue
  severity-medium:   "#94a3b8"   # text-secondary — notable pattern
  severity-low:      "#5b9cf6"   # accent-blue — informational
  severity-positive: "#4ade80"   # accent-win — strength to reinforce

typography:
  fontFamily:
    body: >-
      'DM Sans', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif
    mono: >-
      'JetBrains Mono', 'Fira Code', ui-monospace, monospace
    # Mono is not optional for data — every numeric metric value uses mono.
    # Apply via CSS class .mono or inline fontFamily: 'var(--font-mono)'
    # Also set fontVariantNumeric: 'tabular-nums' always with mono.

  # All headings: fontWeight 600, letterSpacing 0
  header-page:
    fontSize: "1.75rem"           # 28px — .header-title
    fontWeight: "800"
    lineHeight: 1.1
    # Has a 3px teal→blue gradient underline via ::after
  header-section:
    fontSize: "1.1rem"            # ~17.6px — card section heads
    fontWeight: 700
    lineHeight: 1.3
  header-card:
    fontSize: "0.95rem"           # ~15px — card titles, panel headers
    fontWeight: 700
    lineHeight: 1.3

  body-md:
    fontSize: "0.875rem"          # 14px — default body, table rows
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontSize: "0.8rem"            # 12.8px — secondary descriptions
    fontWeight: 400
    lineHeight: 1.5
  body-xs:
    fontSize: "0.75rem"           # 12px — stat labels, column headers
    fontWeight: 400
    lineHeight: 1.4

  label:                          # stat column headers — ALWAYS uppercase + muted
    fontSize: "0.75rem"           # 12px
    fontWeight: 400
    textTransform: uppercase
    letterSpacing: "0.05em"
    color: "var(--text-muted)"

  mono-value:                     # ALL numeric metric values — always mono
    fontFamily: "var(--font-mono)"
    fontVariantNumeric: tabular-nums
    fontFeatureSettings: "'tnum'"
    # Size inherits from context — the rule is just to always use mono for numbers

  navigation:
    fontSize: "0.85rem"
    fontWeight: 600
  nav-subnav:
    fontSize: "0.8rem"
    fontWeight: 500

spacing:
  unit: 4px
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"

  # Semantic aliases
  card-padding: "1.5rem"          # glass-card default — reduces to 0.9rem on mobile
  card-padding-sm: "0.9rem"       # tight cards, nested panels
  page-padding: "1.75rem 2rem"    # main-content default
  page-padding-tablet: "1.25rem"
  page-padding-mobile: "0.85rem"
  section-gap: "1.5rem"           # margin-bottom after .header
  sidebar-width: "256px"
  content-max: "1480px"           # max-width of main content area

radii:
  sm: "7px"     # buttons, inputs, small interactive elements
  md: "10px"    # cards (.glass-card), workspace-header, panels
  lg: "16px"    # large modals, overlay panels
  pill: "999px" # workspace-chip, form strip squares, nav active indicator

elevation:
  # Glassmorphism — blurred, not solid offset. Elevation expressed through
  # surface color (darker = lower, lighter = higher) + subtle shadow depth.
  page:    "bg-page    → no shadow, no border"
  panel:   "bg-panel   → no shadow, 1px border-default right"
  card:    "bg-card    → shadow-card, 1px border-default, radius-md"
  elevated: "bg-elevated → shadow-neon, 1px border-strong, radius-md"
  # On hover, cards step up: border upgrades from border-default → border-strong

borders:
  card-default: "1px solid rgba(255, 255, 255, 0.07)"
  card-hover:   "1px solid rgba(255, 255, 255, 0.12)"
  input-rest:   "1px solid rgba(255, 255, 255, 0.07)"
  input-focus:  "1px solid rgba(91, 156, 246, 0.55)"
  nav-active:   "1px solid rgba(56, 212, 200, 0.28)"
  divider:      "1px solid rgba(255, 255, 255, 0.07)"

motion:
  duration:
    fast: "0.16s"     # all UI transitions — the only duration used
  easing: "ease"
  preset: "var(--transition-fast)"   # shorthand used everywhere
  # Rule: transition only color, background, border-color, box-shadow, opacity.
  # Never transition layout properties (width, height, padding).
  # No animation libraries. No keyframe animations except the spin loader.

background:
  # The body background is the most distinctive visual in PrimeSight.
  # It combines a fixed dark base with layered subtle effects:
  body-layers: |
    linear-gradient(180deg, rgba(17,22,32,0.82), rgba(10,12,16,0.97) 480px),
    radial-gradient(ellipse at 78% 8%, rgba(240,180,41,0.07), transparent 300px),
    radial-gradient(ellipse at 18% 88%, rgba(91,156,246,0.06), transparent 260px),
    linear-gradient(135deg, transparent 46.8%, rgba(56,212,200,0.055) 47% 47.5%, transparent 47.7%),
    linear-gradient(45deg, transparent 52.3%, rgba(167,139,250,0.04) 52.5% 53%, transparent 53.2%),
    linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
  body-size: "auto, auto, auto, auto, auto, 48px 48px, 48px 48px"
  body-attachment: "fixed"
  # Layer semantics:
  # 1. Gradient veil — darkens the raw grid so it reads as subtle
  # 2. Gold radial top-right — Prime/objectives warmth
  # 3. Blue radial bottom-left — analysis/data coolness
  # 4. Teal diagonal — the mid lane (135° corridor)
  # 5. Violet diagonal — the offlane (45° corridor)
  # 6+7. 48px grid — the tactical minimap feel
  # DO NOT simplify this background. It is intentional and brand-defining.

iconography:
  set: lucide
  stroke-width: "2"              # default for all Lucide icons
  sizes:
    xs: "12px"
    sm: "14px"
    md: "16px"                   # most common — nav, button, inline
    lg: "18px"                   # nav section headers, card headers
    xl: "24px"                   # empty states, feature icons
    hero: "36px"                 # ComingSoon, large state screens
  color-rule: >-
    Icons inherit text color unless they carry a semantic meaning.
    Semantic icon colors: teal for vision/wards, gold for objectives,
    green for wins, red for loss/danger, blue for analysis actions.
  nav-icons:
    - Home / LayoutDashboard
    - Film (Matches)
    - BarChart2 (Analysis)
    - Wrench (Team Tools)
    - FileText (Reports)
    - Users (Team Management)
    - Settings (Platform Admin)
    - ChevronDown / ChevronRight (accordion)

components:
  # ── Glass card ─────────────────────────────────────────────────────────────
  glass-card:
    class: ".glass-card"
    background: "linear-gradient(160deg, rgba(30,37,52,0.98), rgba(20,26,38,0.99))"
    border: "1px solid rgba(255,255,255,0.07)"
    borderRadius: "10px"          # radius-md
    padding: "1.5rem"
    boxShadow: "0 4px 24px rgba(0,0,0,0.28)"
    transition: "border-color 0.16s ease, box-shadow 0.16s ease"
    # Has ::before pseudo with blue-gold luminous overlay at 0.3 opacity
    # On hover: border → rgba(255,255,255,0.12)
    note: >-
      The primary surface for all content. Used for KPI cards, data panels,
      player comparison, timeline sections. Every feature section is wrapped
      in a glass-card or a variant of it.

  # ── Button primary ─────────────────────────────────────────────────────────
  button-primary:
    class: ".btn-primary"
    background: "linear-gradient(180deg, #6baaf8, #4a85e0)"
    border: "1px solid rgba(107,170,248,0.4)"
    color: "#050e1f"              # near-black on blue — NOT white
    padding: "0.62rem 1rem"
    borderRadius: "7px"           # radius-sm
    fontSize: "0.84rem"
    fontWeight: "700"
    boxShadow: "0 4px 18px rgba(91,156,246,0.22)"
  button-primary-hover:
    filter: "brightness(1.08)"
    boxShadow: "0 6px 24px rgba(91,156,246,0.32)"
  button-primary-disabled:
    opacity: "0.45"

  # ── Button secondary ────────────────────────────────────────────────────────
  button-secondary:
    class: ".btn-secondary"
    background: "rgba(255,255,255,0.04)"
    border: "1px solid rgba(255,255,255,0.07)"
    color: "var(--text-secondary)"
    padding: "0.62rem 1rem"
    borderRadius: "7px"
    fontSize: "0.84rem"
    fontWeight: "600"
  button-secondary-hover:
    borderColor: "rgba(255,255,255,0.12)"
    background: "rgba(255,255,255,0.07)"
    color: "var(--text-primary)"

  # ── Input ───────────────────────────────────────────────────────────────────
  input:
    class: ".input"
    background: "rgba(10,12,16,0.8)"
    border: "1px solid rgba(255,255,255,0.07)"
    borderRadius: "7px"
    color: "var(--text-primary)"
    fontSize: "0.86rem"
    padding: "0.6rem 0.75rem"
    placeholderColor: "var(--text-dim)"
  input-focus:
    borderColor: "rgba(91,156,246,0.55)"
    boxShadow: "0 0 0 3px rgba(91,156,246,0.1)"

  # ── Page header ─────────────────────────────────────────────────────────────
  header:
    class: ".header"
    marginBottom: "1.5rem"
  header-title:
    class: ".header-title"
    fontSize: "1.75rem"
    fontWeight: "800"
    lineHeight: "1.1"
    color: "var(--text-primary)"
    # ::after — teal→blue gradient underline:
    # width: 3rem, height: 2px, marginTop: 0.55rem, borderRadius: 999px
    # background: linear-gradient(90deg, #38d4c8, #5b9cf6, transparent)

  # ── Workspace header (top bar) ──────────────────────────────────────────────
  workspace-header:
    class: ".workspace-header"
    display: "flex, space-between"
    padding: "0.65rem 0.9rem"
    border: "1px solid rgba(255,255,255,0.07)"
    borderRadius: "10px"
    background: "rgba(17,19,24,0.72)"
    marginBottom: "1.5rem"
    note: "Shows platform title + patch chip + pred.gg connection status"
  workspace-chip:
    class: ".workspace-chip"
    padding: "0.28rem 0.55rem"
    borderRadius: "999px"
    border: "1px solid rgba(255,255,255,0.07)"
    background: "rgba(255,255,255,0.03)"
    fontFamily: "var(--font-mono)"
    fontSize: "0.7rem"
    fontWeight: "500"
    color: "var(--text-dim)"
  workspace-chip-connected:
    borderColor: "rgba(74,222,128,0.22)"
    color: "var(--accent-win)"

  # ── Sidebar ─────────────────────────────────────────────────────────────────
  sidebar:
    width: "256px"
    background: >-
      linear-gradient(160deg, transparent 42%, rgba(56,212,200,0.045) 42.2% 42.8%, transparent 43.1%),
      linear-gradient(20deg, transparent 58%, rgba(240,179,91,0.035) 58.2% 58.7%, transparent 59%),
      linear-gradient(180deg, rgba(14,17,24,0.99), rgba(10,12,16,0.99))
    borderRight: "1px solid rgba(255,255,255,0.07)"
    padding: "1.25rem 0.85rem"
    position: "sticky"
    top: "0"
    height: "100vh"
    overflowY: "auto"
  logo-name:
    fontSize: "1.06rem"
    fontWeight: "800"
    background: "linear-gradient(120deg, #38d4c8, #5b9cf6 65%, #a78bfa)"
    webkitBackgroundClip: text
    note: "Gradient from teal → blue → violet — brand signature"
  nav-link:
    padding: "0.62rem 0.75rem"
    borderRadius: "7px"
    fontSize: "0.85rem"
    fontWeight: "600"
    color: "var(--text-secondary)"
    border: "1px solid transparent"
    transition: "background 0.16s, color 0.16s"
  nav-link-active:
    background: "rgba(56,212,200,0.08)"
    borderColor: "rgba(56,212,200,0.28)"
    color: "var(--text-primary)"
    # ::before — 3px teal pill on the left edge (left: -0.5rem, height: 1.2rem)
    leftIndicator: "3px solid #38d4c8"
  nav-section-header:
    # Accordion section button — only one section open at a time
    padding: "0.55rem 0.75rem"
    fontSize: "0.82rem"
    fontWeight: "600"
    color: "var(--text-secondary)"
  nav-sublink:
    padding: "0.38rem 0.5rem"
    fontSize: "0.8rem"
    fontWeight: "500"
    color: "var(--text-muted)"
    indented: "1.6rem from left, with vertical border-left line"
  nav-sublink-active:
    background: "rgba(56,212,200,0.08)"
    borderColor: "rgba(56,212,200,0.28)"
    color: "#38d4c8"
    fontWeight: "600"

  # ── Stat column (KPI card pattern) ─────────────────────────────────────────
  stat-label:
    fontSize: "0.75rem"
    textTransform: uppercase
    letterSpacing: "0.05em"
    color: "var(--text-muted)"
    marginBottom: "0.25rem"
  stat-value:
    fontFamily: "var(--font-mono)"
    fontVariantNumeric: tabular-nums
    # Size varies by context: 1.5rem for hero KPIs, 1rem for table cells
    note: "ALWAYS mono. No exceptions. All numbers in PrimeSight use mono."

  # ── Role badge ──────────────────────────────────────────────────────────────
  role-badge:
    style: "inline-flex, gap 0.35rem, fontSize 0.72rem, fontWeight 600"
    borderRadius: "4px"
    padding: "0.2rem 0.45rem"
    background: "rgba of the role color at 0.15 opacity"
    color: "role color at full opacity"
    # Colors:
    # carry:   bg rgba(240,180,41,0.15)  text #f0b429
    # jungle:  bg rgba(127,214,107,0.15) text #7fd66b
    # midlane: bg rgba(167,139,250,0.15) text #a78bfa
    # offlane: bg rgba(248,113,113,0.15) text #f87171
    # support: bg rgba(56,212,200,0.15)  text #38d4c8

  # ── Severity badge (insights, review items) ─────────────────────────────────
  severity-badge:
    style: "inline-flex, fontSize 0.72rem, fontWeight 700, textTransform uppercase"
    padding: "0.2rem 0.5rem"
    borderRadius: "4px"
    # critical:  bg rgba(248,113,113,0.2)  text #f87171  border rgba(248,113,113,0.4)
    # high:      bg rgba(240,180,41,0.2)   text #f0b429  border rgba(240,180,41,0.4)
    # medium:    bg rgba(148,163,184,0.15) text #94a3b8  border rgba(148,163,184,0.3)
    # low:       bg rgba(91,156,246,0.15)  text #5b9cf6  border rgba(91,156,246,0.3)
    # positive:  bg rgba(74,222,128,0.15)  text #4ade80  border rgba(74,222,128,0.3)

  # ── Form strip (recent form W/L) ────────────────────────────────────────────
  form-strip:
    style: "inline-flex, gap 3px"
    square:
      width: "16px"
      height: "16px"
      borderRadius: "3px"
      win: "background #4ade80"
      loss: "background #f87171"
      unknown: "background rgba(255,255,255,0.08)"

  # ── Column stripe (card left-border accent) ─────────────────────────────────
  column-stripe:
    width: "3px"
    borderRadius: "999px"
    # Used as a vertical colored bar in card headers to indicate context:
    # teal for vision, gold for objectives, blue for analysis, etc.

  # ── ComingSoon page ─────────────────────────────────────────────────────────
  coming-soon:
    icon: "Construction (Lucide), color: var(--accent-teal)"
    iconSize: "36px"
    maxWidth: "480px"
    layout: "centered glass-card with icon + title + description + optional GitHub issue link"

layout:
  app-container:
    display: flex
    minHeight: "100vh"
  sidebar:
    width: "256px"
    flex-shrink: "0"
    sticky: true
  main-content:
    flex: "1"
    padding: "1.75rem 2rem"
    maxWidth: "1480px"
    margin: "0 auto"
  responsive:
    tablet-breakpoint: "920px"    # sidebar collapses to top bar
    mobile-breakpoint: "640px"    # icons-only sidebar, reduced padding

responsive:
  # 920px — tablet
  tablet:
    sidebar: "horizontal top bar, nav scrolls horizontally"
    main-content-padding: "1.25rem"
    workspace-header: "stacks vertically"
  # 640px — mobile
  mobile:
    sidebar: "icons only (text hidden), ultra-compact"
    main-content-padding: "0.85rem"
    glass-card-padding: "0.9rem"
    workspace-subtitle: "hidden"
    logo-name: "hidden (only favicon shown)"
    auth-buttons: "icon only"
---

# PrimeSight

PrimeSight is a private competitive intelligence platform for professional and semi-professional Predecessor (MOBA) teams. It is used by coaches, analysts, managers and players to analyze match data, review objective patterns, prepare Battle Plans, and track training goals.

The platform is always accessed authenticated. It is a tool, not a product page — every screen is working space for staff doing analysis. The design must communicate precision, depth, and professionalism without being visually aggressive. It is not a dashboard for vanity metrics. Every element on screen should be there because a coach needs it.

## Design philosophy in one sentence

**Dark glassmorphism surfaces, strict mono typography for all numbers, game-role color semantics, and a layered grid-plus-lane background that makes every screen feel like the platform belongs to Predecessor — not a generic SaaS app.**

## Voice

Spanish in planning discussions, English in data labels and technical terms. UI labels are in English (Win Rate, GPM, Deaths Before Objective). Prose guidance (insight recommendations, comingSoon descriptions) can be in either language. Code comments are in English. Never mix languages mid-sentence.

Data labels: short, uppercase, factual. `WIN RATE`, `AVG GPM`, `DEATHS BEFORE OBJ`. No exclamation marks, no gamification language, no congratulatory copy. If a metric is good, the number shows it — the UI doesn't cheer.

Error states: direct and specific. "No event stream data — run Sync Matches first" instead of "Oops! Something went wrong."

## Color

Four background tiers carry all depth. Going darker means going lower. There are no gradients between tiers — surfaces are solid blocks at their tier's color, distinguished by border and shadow.

- `bg-page #0a0c10` — canvas. Nothing sits here directly; it bleeds through gaps.
- `bg-panel #111318` — sidebar, secondary containers. The resting dark.
- `bg-card #1e2330` — primary surface for content. Most content lives here.
- `bg-elevated #252c3a` — dropdowns, hover rows, tooltips, active sidebar sub-items.

Accents are used with restraint. **Blue is action** — buttons, CTA, focus, links. **Teal is vision and scouting** — navigation active state, ward-related data, map context, connection status. **Gold/prime is objectives** — anything related to Fangtooth, Prime, Shaper, gold economy, carry role. **Violet is intelligence and rank** — draft data, rating badges, midlane role. **Green is good, red is bad** — wins, positive trends vs losses, risks, critical alerts.

Role colors are borrowed directly from common Predecessor color conventions and are applied consistently across every page: gold for carry, bright green for jungle, violet for midlane, red for offlane, teal for support. If a row, badge, or indicator references a player or role, it uses that role's color.

Team identity is always teal (OWN) vs red (RIVAL). This applies to cards, badges, chart bars, timeline annotations — everywhere a team distinction matters.

## Typography

Two families: **DM Sans** for all interface text, **JetBrains Mono** for all numeric data.

The mono rule is absolute: every number displayed as a metric — KDA, win rate percentages, GPM, DPM, match counts, timestamps, gold values — uses `font-family: var(--font-mono)` with `font-variant-numeric: tabular-nums`. No exceptions. The visual signature of PrimeSight is data that reads like a terminal: crisp, aligned, unambiguous.

Stat labels sit above or beside their values, always uppercase, always muted (`var(--text-muted) #64748b`), always at 0.75rem / 0.05em tracking. The label declares the metric; the mono value delivers it.

Headings use DM Sans at weight 600 (section heads) or 700–800 (page titles). Page titles have a mandatory teal→blue gradient underline via `::after` (3rem wide, 2px tall, gradient from `#38d4c8` to `#5b9cf6` fading to transparent). This is a page-level brand marker — not applied to card titles or section heads.

## Glassmorphism cards

`.glass-card` is the primary surface. It uses a near-opaque dark gradient background (`rgba(30,37,52,0.98)` → `rgba(20,26,38,0.99)`), a thin 1px white/07 border, a 10px border-radius, and a `0 4px 24px rgba(0,0,0,0.28)` shadow. It has a `::before` pseudo-element that applies a faint blue-gold luminous sweep at 0.3 opacity — this creates the glassmorphism shimmer without being heavy.

On hover, the border steps up to `/12` opacity. The card does not translate or scale — PrimeSight cards are not interactive cards in the marketing sense. They are data panels. Hover state just acknowledges focus.

All content inside `.glass-card` sits in `position: relative; z-index: 1` to clear the `::before` overlay.

## The background

The body background is not decoratable — it is architecture. It has seven layers rendered as a single `background-image` fixed to the viewport:

1. A gradient veil that darkens the raw lines to subtlety
2. A warm gold radial in the top-right corner (Prime/objectives warmth)
3. A cool blue radial in the bottom-left (analysis depth)
4. A teal diagonal stripe at 135° — the mid lane corridor
5. A violet diagonal stripe at 45° — the offlane corridor
6. A horizontal grid line every 48px
7. A vertical grid line every 48px

The result looks like a tactical minimap — the game's spatial logic embedded in every screen. Never simplify or replace this background. It is what makes the interface feel like it belongs to Predecessor.

## Sidebar accordion

The sidebar has eight collapsible sections. Only one section can be open at a time (accordion behavior). When a new section is opened, the previously open section closes. When navigating directly to a route inside a section, that section auto-opens and others close.

Active links have a `rgba(56,212,200,0.08)` background, a teal border, and a 3px teal pill indicator at the left edge (an absolute `::before` element, `width: 3px, height: 1.2rem`). This is the same visual language as a "current lane" marker.

The logo gradient runs `#38d4c8 → #5b9cf6 → #a78bfa` (teal → blue → violet) — the full analytical spectrum in one lockup.

## Severity system

The Analyst Rules Engine produces insights at five levels. Each level has a strict color identity that applies to badges, card borders, and icons:

| Severity | Color | CSS | Usage |
|----------|-------|-----|-------|
| critical | loss red | `#f87171` | Deaths before objective, patterns requiring immediate review |
| high | prime gold | `#f0b429` | Significant patterns, vision gaps, throw rate alerts |
| medium | text secondary | `#94a3b8` | Notable trends, slumps, watch items |
| low | accent blue | `#5b9cf6` | Informational, minor patterns |
| positive | win green | `#4ade80` | Strengths to reinforce, conversion rates above threshold |

## Data display conventions

All tables follow the same structure: sticky header row (uppercase muted labels), alternating no-hover by default (hover adds `bg-elevated` background), numeric columns right-aligned in mono, text columns left-aligned. Do not center-align data columns.

KPI cards: the number dominates (large mono), the label sits above it (small uppercase muted), and optional delta/trend sits below in smaller text with a directional arrow.

Progress bars use the standard `bg-elevated` track with a colored fill. Colors match the metric's semantic: teal for vision, gold for objectives, green for positive metrics.

Percentages displayed without the `%` symbol in column headers (the header declares the unit). Inside the cell: `67%` with the percent sign, in mono.

## Responsive behavior

At 920px, the sidebar collapses to a horizontal top bar with nav items scrolling horizontally. Accordion sections lose their collapsing behavior and show as flat links.

At 640px, the sidebar compresses to icon-only (text labels hidden), the logo text disappears (only favicon shown), and the auth button shows icon only. Card padding reduces from 1.5rem to 0.9rem. The workspace subtitle is hidden.

## What PrimeSight does not do

- No light theme. The platform is always dark. There is no theme toggle.
- No gradients on text except the sidebar logo.
- No animations except the `spin` keyframe on loading spinners.
- No illustration, no photography, no decorative shapes.
- No rounded pill buttons — buttons use 7px radius, not `border-radius: 9999px`.
- No celebration animations on win states — the number shows the win, the UI does not react.
- No color-coding by team unless the OWN/RIVAL distinction is explicit and intentional.
- No tables without column headers. No numbers without units or labels.
- No placeholder text that looks like real data.
- No truncating stat labels — if a label doesn't fit, the layout needs to change.

## Quick component guide

**Glass card:** `.glass-card` — dark gradient surface, 1px/07 border, 10px radius, 24px shadow. All content goes here.

**Primary button:** `.btn-primary` — blue gradient (#6baaf8→#4a85e0), near-black text (#050e1f), 7px radius, blue glow shadow. Used for primary actions (Sync, Export, Create).

**Secondary button:** `.btn-secondary` — near-transparent background, white/07 border, muted text. Used for secondary actions (Filter, Cancel, View).

**Input:** `.input` — very dark background (rgba 10,12,16,0.8), white/07 border, focus upgrades border to blue with glow ring.

**Mono number:** wrap in `.mono` class or apply `fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums'` inline.

**Stat label:** `fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)'` — no separate class, applied inline.

**Role badge:** `background: rgba(roleColor, 0.15)`, `color: roleColor`, `borderRadius: 4px`, `padding: 0.2rem 0.45rem`, `fontSize: 0.72rem`, `fontWeight: 600`.

**Severity badge:** `background: rgba(severityColor, 0.2)`, `color: severityColor`, `border: 1px solid rgba(severityColor, 0.4)`, `borderRadius: 4px`, uppercase label.

**Page header:** `.header` > `.header-title` — with the teal→blue gradient underline via `::after`.

**Coming soon:** centered `.glass-card` with `<Construction>` icon in teal at 36px, section name as h2, description, optional GitHub issue link in teal.
