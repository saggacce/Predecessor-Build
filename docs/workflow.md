# Workflow de trabajo — RiftLine

---

## Estrategia de ramas

```
feature/xxx ──┐
feature/yyy ──┤──→ develop ──→ (sprint PR) ──→ main ──→ [approval] ──→ riftline.app
feature/zzz ──┘
```

| Rama | Propósito |
|------|-----------|
| `main` | Producción. Solo recibe PRs de sprint desde `develop`. Cada merge despliega con aprobación manual. |
| `develop` | Acumulación de sprint. Aquí van todos los PRs de features/fixes. CI pasa pero NO hay deploy. |
| `feat/*`, `fix/*`, etc. | Ramas de trabajo. Se abren contra `develop`, no contra `main`. |

---

## 1. Flujo por feature (día a día)

```
develop → feat/mi-feature → commits → PR → CI → merge a develop
```

1. **Partir siempre de `develop` actualizado**
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feat/descripcion-corta
   ```

2. **Trabajar, commitear en incrementos atómicos**
   ```bash
   git add <archivos-especificos>
   git commit -m "feat: descripción en inglés imperativo"
   ```

3. **Push y PR hacia `develop`** (no hacia `main`)
   ```bash
   git push -u origin feat/descripcion-corta
   gh pr create --base develop --title "..." --body "..."
   ```

4. **CI pasa → usuario mergea → branch eliminado**
   ```bash
   git checkout develop && git pull origin develop
   git branch -d feat/descripcion-corta
   ```

---

## 2. Flujo de sprint (deploy a producción)

Al final de cada sprint, cuando el conjunto de features está probado en `develop`:

```
develop → (sprint PR) → main → CI → [approval manual] → deploy a Hetzner
```

1. Abrir PR de `develop` → `main` en GitHub
2. CI corre (typecheck + tests)
3. GitHub pausa el deploy y notifica al responsable
4. Responsable revisa, prueba manualmente en local si hace falta
5. **Aprueba en GitHub** → deploy automático a `https://riftline.app`
6. Actualizar `develop` con main: `git checkout develop && git pull origin main`

---

## 3. Convención de branches

| Prefijo | Cuándo | Ejemplo |
|---------|--------|---------|
| `feat/` | Nueva funcionalidad | `feat/discord-bot-mvp` |
| `fix/` | Corrección de bug | `fix/cookie-secure-http` |
| `chore/` | Config, deps, limpieza | `chore/update-node-22` |
| `refactor/` | Sin cambio funcional | `refactor/sync-service` |
| `docs/` | Solo documentación | `docs/roadmap-update` |

---

## 4. Convención de commits

`tipo: descripción en inglés (imperativo, minúsculas)`

```
feat: add weekly player performance report endpoint
fix: secure cookies only when HTTPS_ENABLED=true
chore: upgrade tsx to dependencies for production
refactor: move asset serving from Express to Vite public/
```

---

## 5. CI/CD

| Evento | CI | Deploy |
|--------|----|--------|
| PR a `develop` | ✅ corre | ❌ no |
| Merge a `develop` | ✅ corre | ❌ no |
| PR a `main` | ✅ corre | ❌ no |
| **Merge a `main`** | ✅ corre | ✅ **con aprobación manual** |

El deploy requiere aprobación en **GitHub → Environments → production** antes de ejecutarse.

---

## 6. Migraciones de BD en producción (Hetzner)

El proyecto usa `prisma db push` en desarrollo, pero las tablas de TimescaleDB (hypertables con chunks comprimidos) bloquean alteraciones automáticas. Toda migración de esquema sigue este protocolo:

### En desarrollo (local)
```bash
# Añadir campos nuevos directamente con SQL
psql "postgresql://predecessor:predecessor@localhost:5432/predecessor_build" \
  -c 'ALTER TABLE "ModelName" ADD COLUMN IF NOT EXISTS "campo" tipo;'

# Regenerar cliente Prisma
npx prisma generate --schema workers/data-sync/prisma/schema.prisma
```

### En producción (Hetzner) — antes del deploy
Cada PR que añade campos al schema debe incluir en el body el SQL de migración exacto. Antes de que el nuevo código arranque en producción, ejecutar contra la BD de Hetzner:

```bash
# Conectar a Hetzner (SSH + psql o acceso directo según configuración)
psql "$DATABASE_URL_PRODUCTION" -c 'ALTER TABLE "ModelName" ADD COLUMN IF NOT EXISTS "campo" tipo;'
```

**Orden obligatorio:**
1. Merge del sprint PR a `main`
2. **Ejecutar el ALTER TABLE en Hetzner** antes de aprobar el deploy
3. Aprobar el deploy en GitHub → Environments → production
4. Verificar en `https://riftline.app`

> Si el servicio arranca antes de añadir la columna, el servidor fallará al acceder al campo nuevo.

### Columnas pendientes de aplicar en Hetzner
| PR | Tabla | SQL |
|----|-------|-----|
| #182 | `MatchPlayer` | `ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "perks" jsonb;` |

---

## 6. Reglas operativas

- **Nunca push directo a `main` ni a `develop`** — siempre por PR.
- **Features van a `develop`**, no a `main`.
- **Un branch por objetivo** — no mezclar features y fixes.
- **Sincronizar antes de empezar**: `git pull origin develop` al inicio de cada tarea.
- **El usuario decide el merge** — Claude abre el PR pero no lo mergea sin instrucción.
- **Producción es sagrada** — si hay dudas, merge a `develop` primero y prueba.

---

## 7. Criterio de "Done" por feature

- Criterios funcionales cumplidos
- Typecheck y tests pasan
- PR mergeado a `develop` y branch eliminado

## Criterio de "Done" por sprint

- Todas las features del sprint en `develop` y validadas
- PR de sprint mergeado a `main`
- Deploy aprobado y verificado en `https://riftline.app`
- `develop` sincronizado con `main`

---

## 8. Git identity (WSL)
```bash
git config user.name "gabriel"
git config user.email "gaby0806@gmail.com"
```
