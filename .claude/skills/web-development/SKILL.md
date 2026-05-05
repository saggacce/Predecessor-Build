---
name: web-development
description: Load for any frontend or backend change. Covers React 19, TypeScript, Express, Prisma patterns, and mobile-first responsive rules for PrimeSight.
---

# Web Development — PrimeSight Stack Reference

## Tech stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + TypeScript + Vite | `apps/web/` |
| Backend | Express + Node.js + TypeScript | `apps/api/` |
| Database | PostgreSQL + Prisma ORM | `workers/data-sync/prisma/` |
| Auth | OAuth2 PKCE + HTTP-only cookies | 30-day session refresh |
| Shared types | `packages/data-model/` | DTOs consumed by both apps |
| Domain logic | `packages/domain-engine/` | Pure TS, no I/O |
| Tests | Vitest + Supertest | Run: `npm test` |
| Typecheck | TypeScript strict | Run: `npm run typecheck` |

## Frontend patterns (React 19)

### Component structure
- Functional components only, typed with TypeScript
- Inline styles for component-specific layout (avoids CSS class proliferation)
- CSS classes (App.css / index.css) for reusable design tokens and global components
- No CSS Modules — styles live in `index.css`, `App.css`, or inline

### CSS approach
```tsx
// Inline style for component-specific layout
<div style={{ display: 'flex', gap: '1rem', padding: '1.5rem' }}>

// CSS class for design system components
<div className="glass-card">
<button className="btn-primary">
```

### Key CSS classes (App.css / index.css)
| Class | Purpose |
|-------|---------|
| `.glass-card` | Standard card — dark background + subtle border |
| `.btn-primary` | Blue gradient button (blue `#6baaf8 → #4a85e0`) |
| `.header` | Page header container |
| `.header-title` | Page title (`h1`) |
| `.mono` | Apply mono font + tabular nums to any element |
| `.sidebar` | Left navigation panel |
| `.sidebar-nav` | Nav links container |

### API client pattern
```tsx
import { apiClient, ApiErrorResponse } from '../api/client';

// Always handle errors — ApiErrorResponse has .error.message and .error.code
try {
  const data = await apiClient.players.search(query);
} catch (err) {
  const msg = err instanceof ApiErrorResponse ? err.error.message : 'Unexpected error';
  toast.error(msg);
}
```

### Toast pattern (sonner — already installed)
```tsx
import { toast } from 'sonner';
toast.success('Done');
toast.error('Something went wrong');
const id = toast.loading('Working...');
toast.success('Finished', { id });   // replaces loading toast
```

## Backend patterns (Express + TypeScript)

### Route structure (`apps/api/src/routes/`)
```ts
router.get('/:id', async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);  // always pass to error-handler middleware
  }
});
```

### Logging (Pino — `apps/api/src/logger.ts`)
```ts
import { logger } from '../logger';
logger.info({ userId }, 'action completed');
logger.warn({ err }, 'partial data');
logger.error({ err }, 'operation failed');
```

### Prisma queries (`apps/api/src/db.ts`)
```ts
import { db } from '../db';
const player = await db.player.findUnique({ where: { id } });
```

## Responsive — mobile-first breakpoints

PrimeSight is a staff tool. Mobile = quick lookups between games, not full dashboard.

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | `< 640px` | Single column; sidebar hidden (hamburger) |
| Tablet | `640px – 1024px` | Sidebar collapsed (icons only); 1-2 columns |
| Desktop | `> 1024px` | Full sidebar + 2-3 column layout |

### Mobile-first CSS rule
Always write the base style for mobile, then expand with `min-width`:
```css
.container {
  display: flex;
  flex-direction: column;   /* mobile: stack */
  gap: 1rem;
}

@media (min-width: 640px) {
  .container {
    flex-direction: row;    /* tablet+: side by side */
  }
}

@media (min-width: 1024px) {
  .container {
    gap: 1.5rem;            /* desktop: more breathing room */
  }
}
```

### Responsive grid pattern
```tsx
// Use CSS grid with auto-fit for card grids
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1.5rem'
}}>
```

### Views that MUST work on mobile
- Player search → profile (KDA, winrate, top heroes)
- Team roster (player list with role + rank)
- Scrim Report (summary, read-only)
- Dashboard (API status, current patch, last sync)

### Views that can skip mobile optimization
- Heatmaps (require large screen)
- Multi-column analytics tables
- Complex creation forms

### Table rules on mobile
- Sticky first column (player/name)
- Show only 3-4 key columns; rest via horizontal scroll
- Use chips instead of long text for role, rank, status

### Current state (note)
The app currently has one media query at `920px` in `App.css` (sidebar collapse).
Full mobile-first breakpoints at 640px/1024px per the design doc are not yet implemented.
When adding responsive behavior to a page, follow the design doc breakpoints, not the existing 920px.

## Key files for web development
| File | Purpose |
|------|---------|
| `apps/web/src/index.css` | Design tokens (CSS variables), global resets, `.mono` utility |
| `apps/web/src/App.css` | Shared components: sidebar, buttons, cards, nav, responsive |
| `apps/web/src/App.tsx` | Root layout: Sidebar + WorkspaceHeader + Routes |
| `apps/web/src/api/client.ts` | Typed fetch client + `ApiErrorResponse` class |
| `apps/web/src/pages/` | Dashboard, PlayerScouting, TeamAnalysis, ScrimReport |
| `apps/api/src/routes/` | Express routers (auth, players, teams, reports, admin, patches) |
| `apps/api/src/services/` | Business logic (player-service, team-service, report-service) |
