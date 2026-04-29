# CLAUDE.md — Predecessor Build Project

Archivo de contexto para Claude. Leer al inicio de cada sesión.

## Repositorio

- **Path WSL:** `/var/opt/Predecessor-Build`
- **GitHub:** `https://github.com/saggacce/Predecessor-Build`
- **Branch principal:** `main`
- **Git identity:** `gabriel / gaby0806@gmail.com`

## Proyecto

Herramienta web de análisis para el videojuego **Predecessor**:
- Scouting de jugadores y equipos rivales
- Análisis de partidas y reportes pre-scrim
- Build planner y calculadora de stats (fase posterior)

Ver `docs/project_predecessor.md` para el detalle completo.

## Tech stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript (pendiente) |
| Backend | Node.js + TypeScript (pendiente) |
| Domain engine | `packages/domain-engine` (TypeScript puro) |
| Tests | Vitest |
| Monorepo | npm workspaces |
| Base de datos | PostgreSQL (pendiente) |
| Cache | Redis (pendiente) |
| API externa | pred.gg GraphQL + omeda.city REST |

## Fuentes de datos

### pred.gg GraphQL
- **Endpoint:** `https://pred.gg/gql`
- **Auth:** Sin auth para datos públicos. `X-Api-Key: <PRED_GG_CLIENT_SECRET>` para producción.
- **No usar:** el mutation `authorize` — requiere sesión de usuario activa.
- **Script de exploración:** `explore_predgg_api.py`
- **Credenciales:** `.env` (ver `.env.example`)

### omeda.city REST
- **Endpoint:** `https://omeda.city`
- **Auth:** No requiere autenticación.
- **Script de exploración:** `scripts/explore_omeda_api.py`
- **Samples:** `scripts/api-samples/`

## Workflow de desarrollo

Flujo completo autónomo de Claude:

```
git pull origin main
git checkout -b <tipo>/<descripcion>
# ... trabajar, editar, validar ...
git add <archivos>
git commit -m "tipo: descripción"
git push -u origin <branch>
# Crear PR vía GitHub API
# Esperar merge del usuario → limpiar branch local
```

Ver `docs/workflow.md` para detalle completo y convenciones.

## Documentación obligatoria antes de cada tarea

1. `docs/planning.md` — tareas activas con estado
2. `docs/project_predecessor.md` — visión, alcance y roadmap
3. `docs/predecessor_api_technical_doc.md` — integración API
4. `docs/future_features_roadmap.md` — backlog y dependencias

## Estado actual del proyecto

**Fase activa:** Tarea 1 — Fundaciones de datos (Scouting)

| Tarea | Estado |
|-------|--------|
| Exploración de APIs (pred.gg + omeda.city) | ✅ Completado |
| Autenticación pred.gg documentada | ✅ Completado |
| CI/CD GitHub Actions | ✅ Completado |
| Workflow Claude + PR definido | ✅ Completado |
| Esquema normalizado (jugador, equipo, partida, parche) | ⏳ Pendiente |
| Pipeline de sincronización de datos | ⏳ Pendiente |
| API de scouting MVP | ⏳ Pendiente |
| Frontend de análisis competitivo | ⏳ Pendiente |

## Estructura del repositorio

```
docs/                          # Documentación del proyecto
  planning.md                  # Tareas activas ← leer primero
  project_predecessor.md       # Spec de producto
  predecessor_api_technical_doc.md  # Referencia API
  workflow.md                  # Flujo de trabajo
  future_features_roadmap.md   # Backlog futuro
packages/
  data-model/                  # Tipos TypeScript compartidos
  domain-engine/               # Motor de cálculo (stats, builds)
scripts/
  explore_omeda_api.py         # Explorador omeda.city
  api-samples/                 # Fixtures JSON de APIs
explore_predgg_api.py          # Explorador pred.gg GraphQL
.env.example                   # Variables de entorno requeridas
CLAUDE.md                      # Este archivo
```
