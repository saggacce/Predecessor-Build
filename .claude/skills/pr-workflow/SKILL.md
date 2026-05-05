---
name: pr-workflow
description: Load when creating branches, staging commits, pushing, or opening PRs on this project.
---

# Git / PR Workflow — PrimeSight

## Branch naming
| Prefix | When to use |
|--------|------------|
| `feat/` | New functionality |
| `fix/` | Bug correction |
| `docs/` | Documentation only |
| `chore/` | Config, dependencies, cleanup |
| `refactor/` | Internal changes, no behavior change |

## Commit format
`type: description in English (imperative, lowercase)`

Valid examples:
```
feat: add custom player name endpoint
fix: correct level-18 stat interpolation
chore: add pino structured logging
docs: update pred.gg event stream findings
```

## Full workflow
```bash
# 1. Start from updated main
git checkout main && git pull origin main

# 2. Create branch
git checkout -b <type>/<short-description>

# 3. Work, edit files, validate
npm run typecheck && npm test

# 4. Stage and commit (specific files, never git add .)
git add <specific-files>
git commit -m "type: description"

# 5. Push
git push -u origin <branch>

# 6. Open PR (gh CLI v2.92.0 is installed)
gh pr create --title "..." --body "..."

# 7. User reviews and merges — NEVER merge without explicit user instruction

# 8. After merge
git checkout main && git pull origin main && git branch -d <branch>
```

## Rules
- Never push directly to `main`
- One branch per objective — no mixed feat+fix+docs
- Always stage specific files — never `git add .` or `git add -A`
- User decides the merge — open PR and wait
- Merging on GitHub does NOT update WSL — always `git pull origin main` after merge
- `gh` CLI is authenticated as `saggacce` via git credential store
