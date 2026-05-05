# AGENTS.md — PrimeSight

## Project
PrimeSight — private competitive intelligence tool for the MOBA game Predecessor.
Frontend: React 19 + TypeScript + Vite. Backend: Express + Node.js + TypeScript.
Database: PostgreSQL + Prisma ORM. Auth: OAuth2 PKCE + HTTP-only cookies.
External API: pred.gg GraphQL (`https://pred.gg/gql`). Logging: Pino JSON structured.
Tests: Vitest + Supertest. Monorepo: npm workspaces.

## Role — Codex
Use for scoped, well-defined implementation work:
- Code changes and bug fixes
- Writing and fixing tests (Vitest + Supertest)
- Prisma migrations (`workers/data-sync/prisma/schema.prisma`)
- TypeScript typecheck fixes
- Refactors with explicit rules
- Implementing approved briefs from Claude Code

## Do NOT use Codex for
- Planning new features or choosing between approaches
- Cross-file architecture decisions
- Ambiguous requirements → stop and reply: "This needs a brief from Claude Code first."

## Routing — Codex vs Claude Code
| Codex (here) | Claude Code |
|-------------|-------------|
| Implement approved brief | Plan and design the feature |
| Fix typecheck / lint errors | Investigate API or codebase |
| Write or fix tests | Review PRs and decisions |
| Prisma migrations | Debug complex multi-file issues |
| Mechanical refactors | Design the approach |

## Hard constraints
- Never push directly to `main`
- Always work on a named branch: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`
- Run `npm run typecheck && npm test` before marking any task done
- Stage specific files only — never `git add .`
- Commit format: `type: description in English (imperative, lowercase)`
- Do not modify files outside the task scope
- Do not claim completion without validation evidence

## Skills — load when relevant
| Skill | When to load |
|-------|-------------|
| `.claude/skills/ui-design-system/SKILL.md` | Any UI, CSS, page, or component change |
| `.claude/skills/pred-gg-api/SKILL.md` | Sync worker, GraphQL queries, event stream |
| `.claude/skills/pr-workflow/SKILL.md` | Creating branches, commits, or PRs |
