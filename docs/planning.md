# Planning del proyecto — RiftLine

Tablero de tareas generales y subtareas.

> **Nombre comercial:** RiftLine · **Tagline:** Competitive Intel · **Empresa:** Synapsight
> **Stack:** React 19 + TypeScript + Vite · Express + Node.js · PostgreSQL + Prisma · OAuth2 PKCE · Pino

---

## Estado
- [ ] Pendiente
- [x] Completada
- [~] Pospuesta (fuera de scope actual)

---

## Principios de producto activos
- **Prescripción antes que descripción** — cada pantalla responde "qué hace el staff con este dato"
- **Reglas antes que IA** — primero insights deterministas; LLM solo resume evidencias ya calculadas
- **Review asistida, no sustituida** — la API detecta eventos; el coach confirma la causa real
- **Patch-aware** — filtrar por parche; avisar cuando la muestra mezcla versiones distintas
- **Muestra mínima** — no destacar WR/pocket picks sin suficientes partidas
- **Bajo ruido** — dashboards y bot solo muestran eventos críticos, no todo

## Los tres pilares estratégicos
1. **Objective Intelligence** — control, setup, conversión, muertes antes de objetivo
2. **Vision Intelligence** — wards, visión antes de objetivo, limpieza, zonas sin cobertura
3. **Pre-Match Intelligence** — Battle Plan, must-bans, amenazas por rol, win conditions

---

# BLOQUE A — COMPLETADO

## [x] Tarea 1 — Fundaciones de datos
- [x] Esquema normalizado: jugador, equipo, partida, parche → `schema.prisma`
- [x] Sincronización desde pred.gg → `workers/data-sync/`
- [x] Versionado por parche/sync timestamp → modelo `Version`
- [x] Política de calidad/frescura de datos → `docs/data_quality_policy.md`

## [x] Tarea 2 — API de scouting (MVP)
- [x] `GET /players/:id` — perfil de jugador
- [x] `GET /teams/:id` — perfil de equipo
- [x] `POST /players/compare` — comparación de jugadores
- [x] `POST /reports/scrim` — generación de reportes de scrim

## [x] Tarea 3 — Frontend de análisis competitivo (MVP)
- [x] Login con pred.gg (OAuth2 PKCE + sesión persistente 30 días)
- [x] Player Scouting — perfil completo, evolución, TrendChart, form strip, hero pool, CS/wards/multi-kills
- [x] Team Analysis — roster, performance, winrate by patch/side, first tower, conversion rates, early death rate, objective control, hero pool, scouting report, ban targets
- [x] Scrim Report — intel notes, ban targets, objective control, export PDF/clipboard
- [x] Gestión de equipos — crear, editar, añadir jugadores, auto-sync al añadir

## [x] Tarea 4 — Calidad y operación
- [x] Logs/errores: Pino, logging JSON estructurado
- [x] 106 tests en Vitest + Supertest (cobertura: players, teams, admin, auth, map-zones, domain-engine)
- [x] CI/CD GitHub Actions + branch protection en main
- [x] Tests de agregación de métricas de jugador (PR #47)
- [x] Tests de filtros por parche/ventana temporal (PR #47)

## [x] Tarea 5 — Gestión de jugadores
- [x] `customName` — API PATCH + UI inline edit + display logic en toda la app
- [x] Logo de equipo (upload base64 + URL)
- [x] Consola players: filtro `isConsole: false` en sync para no intentar sincronizar perfiles inexistentes

## [x] Tarea 6 — Analysis Tools: Match Detail e indicadores
### [x] 6A — Scoreboard completo (PR #40)
### [x] 6B — Statistics tab (16 campos extendidos: daño P/M/T, CS, healing, highlights)
### [x] 6C — Event stream sync (HeroKill, ObjectiveKill, StructureDestruction, WardEvent, Transaction, HeroBan)
### [x] 6D — Timeline tab (swim lanes, zoom, tooltips, minimapa calibrado con MAP_BOUNDS)
### [x] 6E — Analysis tab (Objective Control, Gold Diff, Deaths Before Objective, Heatmap)
### [x] 6F — Indicadores del catálogo (PR #44)

## [x] Tarea 8 — Analyst: Rules Engine (9 reglas deterministas)
- [x] `GET /analysis/insights/:teamId` → lista ordenada por severidad
- [x] Reglas: muerte crítica pre-objetivo, baja visión, visión limpiada, prime no convertido, draft dependency, throw pattern, player slump, vision gaps, refuerzo positivo
- [x] Data Status insight — distingue "datos de jugador OK" vs "event stream pendiente"
- [x] Panel "Analyst" en TeamAnalysis con InsightCard (severity badge, evidencia colapsable, botón Review)

## [x] Tarea 10 — Team Tools: Review Queue y flujo de entrenamiento
- [x] Modelos `ReviewItem`, `TeamGoal`, `PlayerGoal` en schema.prisma
- [x] CRUD `/review/items`, `/review/goals/team/:teamId`, `/review/goals/player/:teamId`
- [x] Página Review Queue con 2 tabs: Review Queue + Team Goals (KPI strip, filtros, inline edit)
- [x] 8 estados de ReviewItem, 8 tags manuales de causa
- [x] Player Goals UI — panel inline en PlayerScouting

## [x] Tarea 11 — UI/UX V2: mejoras de calidad
- [x] Colores OWN (cian) / RIVAL (rojo), hover highlight en tablas
- [x] Pocket Pick Highlight — borde dorado en héroes con <10 partidas pero >65% WR
- [x] One-Trick Alert, Quick Report button, Sticky header en Player Comparison
- [x] Pulse Server LED, Visual VS con logos en Battle Plan
- [x] Intelligence Notes por categoría: alertas / oportunidades / bans
- [x] Win Conditions prescriptivas, modo Full Screen para proyección

## [x] Tarea 12 — Pre-Match Intelligence: Battle Plan prescriptivo (parcial en ScrimReport)
- [x] Selector VS con logos de ambos equipos
- [x] Win Conditions prescriptivas desde rival scouting data
- [x] Target Players — amenazas por rol con threat score (`/analysis/rival`)
- [x] Objective Plan — control por objetivo con timing medio

## [x] Tarea 13 — Zonas tácticas del mapa
- [x] 11 zonas calibradas desde coordenadas reales de ObjectiveKill
- [x] Tabla `MapZone` + `GET /map-zones` + `POST /map-zones/seed`
- [x] `pointInZone(x, y, polygon)` ray casting en `domain-engine`
- [x] 8 tests de correctness

## [x] Tarea 16 — VOD & Replay Index
- [x] Modelo `VodLink` en schema.prisma
- [x] CRUD `/vod` completo
- [x] Página `VodIndex.tsx` con filtros, botón "Open at timestamp"

## [x] Tarea 17 — Auth: RBAC, invitaciones y perfiles de usuario
- [x] Modelos `User`, `TeamMembership`, `Invitation` en schema.prisma
- [x] Login bcrypt 12 + JWT 1h + refresh token 30d (cookies httpOnly)
- [x] Roles globales: `PLATFORM_ADMIN` | `VIEWER`
- [x] Roles por equipo: `MANAGER` | `COACH` | `ANALISTA` | `JUGADOR`
- [x] Middleware `requireAuth` + `requireRole` + `requirePlatformAdmin`
- [x] Security hardening: rate limiting, timing attack fix, cookie secure en prod, audit log
- [x] UI login/registro/gestión de usuarios
- [x] RBAC en sidebar: secciones visibles según rol
- [x] "View As Role" — admin puede previsualizar la UI como cualquier rol (sessionStorage)
- [x] Vinculación de perfil de jugador (`User.linkedPlayerId`) — modal de búsqueda y linkeo

## [x] Tarea 20 — Backend Analytics: catálogo de métricas
- [x] Phase Analysis, Vision Analysis, Objective Analysis, Draft Analysis por equipo
- [x] Player Advanced Metrics (Gold/Damage/Kill Share %, Efficiency Gap, Death Rates)
- [x] Rival Scouting frontend `/analysis/rival` (identity, form, threat players, objectives)
- [x] Platform Admin panel (Staff & Invitations, Data Controls, Audit Logs)

## [x] Tarea 21 — Identidad visual y UX: rebrand a RiftLine
- [x] Nombre: RiftLine (sin espacio) · Tagline: "Competitive Intel" · Empresa: Synapsight
- [x] Landing page con HeroShowcase (grid 4×3 de heroes reales de Predecessor)
- [x] Login fullscreen sin sidebar — botones sociales (Discord/Steam/Epic — próximamente)
- [x] Dashboard diferenciado por rol (MANAGER, COACH, ANALISTA, JUGADOR, PLAYER standalone)
- [x] Sidebar filtrado por rol, sin secciones irrelevantes para PLAYER
- [x] Error boundaries en PlayerScouting y TeamAnalysis para diagnóstico de crashes
- [x] Documentación de patrones de crash React → `docs/react_crash_patterns.md`

## [x] Tarea 22 — Infraestructura: despliegue y retención de datos
- [x] Saneamiento de DB: borrado de datos anteriores a Feb 2026 + jugadores inactivos + QA seed
- [x] Sistema de retención configurable (`DATA_RETENTION_MONTHS`, por defecto 3)
- [x] `cleanupOldData()` en sync-service — borra event stream + matches + jugadores inactivos
- [x] Endpoint `POST /admin/cleanup-old-data` para ejecución manual
- [x] Cron mensual automático (día 1, 03:00h) con `node-cron`
- [x] Filtro de retención en sync: `syncRecentMatchesForPlayer` no persiste partidas antiguas
- [x] `railway.toml` — build: `npm install + prisma generate + vite build`; start: `tsx apps/api/src/index.ts`
- [x] API sirve el frontend estático en producción (single service)
- [x] Migración de assets a `apps/web/public/` (servidos por Vite directamente)
- [ ] **Despliegue activo en Railway** — PR #152 mergeado, DB migrada, variables configuradas

---

# BLOQUE B — EN CURSO / PRÓXIMO

## Tarea 9 — Analyst: LLM (Claude API)
*Prerequisito: Tarea 8 completa y validada en producción.*

- [ ] Prompt caching para contexto del juego (system prompt fijo con reglas de Predecessor)
- [ ] Streaming SSE al frontend → "Focus of the Day" en Dashboard
- [ ] AI Summary: LLM resume insights ya calculados, no inventa causalidad
- [ ] Coste estimado: <$0.01 por análisis con claude-sonnet-4-6

---

## Tarea 14 — Team Tools: Tactical Board
Pizarra interactiva sobre el mapa de Predecessor.

- [ ] Modelos `TacticalBoard` + `BoardObject` en schema.prisma
- [ ] Crear tablero vacío sobre mapa, añadir markers/texto/flechas/zonas
- [ ] Guardar/cargar tablero, asociar a match/equipo/rival
- [ ] Exportar como imagen
- [ ] Librería recomendada: Konva.js

---

## Tarea 15 — Team Tools: Tactical Timeline (review con anotaciones)
Diferente al Timeline tab de Match Detail — orientado a sesión de review de equipo.

- [ ] Cargar partida, eventos sobre mapa con slider temporal
- [ ] Event Feed lateral con filtros por objetivo/ventana/rol
- [ ] Crear Review Item desde evento
- [ ] Guardar sesión asociada a match

---

## Tarea 23 — B2C: Player Reports
Para jugadores individuales (PLAYER standalone).

- [ ] `GET /reports/player-weekly/:playerId` — KDA semanal vs histórico, héroe más jugado, WR 7d vs 30d
- [ ] Página `/reports/weekly` con condicional por rol
- [ ] Player Development autogenerado desde métricas históricas (slump, hero pool, etc.)

---

## Tarea 24 — Coach Session Mode
Vista limpia para proyectar en Discord/stream interno.

- [ ] Battle Plan + 3 insights clave + objetivos de sesión
- [ ] Sin distracciones de navegación
- [ ] Acceso rápido desde header para MANAGER/COACH

---

## Tarea 18 — Discord Companion Bot
*Prerequisito: Tarea 8 + Tarea 10 en producción.*

- [ ] Vincular servidor Discord con equipo de RiftLine
- [ ] Configurar canales por tipo (alerts, match-reports, review-queue, team-goals, scouting)
- [ ] Enviar resumen de partida al importar
- [ ] Enviar Review Alert cuando `severity: critical`
- [ ] Slash commands básicos: `/riftline match`, `/riftline review pending`, `/riftline report last-match`

---

## Tarea 25 — Infraestructura: TimescaleDB
*Después de estabilizar el despliegue en Railway.*

- [ ] Convertir tablas de event stream a hypertables (`HeroKill`, `ObjectiveKill`, `WardEvent`, `Transaction`, `StructureDestruction`)
- [ ] Activar compresión columnar automática para chunks > 1 mes
- [ ] Migrar `cleanupOldData()` a `drop_chunks()` (ms vs minutos)
- [ ] Objetivo: reducción de 5-10x en espacio de event stream

---

## Tarea 19 — Team Tools: Scrim Planner, Playbook, Review Sessions
*Fase posterior — construir cuando Review Queue y Tactical Board estén validados.*

- [ ] Scrim Planner — planificador con focus area vinculada a métrica
- [ ] Playbook — biblioteca de estrategias, setups y reglas tácticas del equipo
- [ ] Review Sessions — sesiones organizadas con agenda, boards y action items

---

# BLOQUE C — BACKLOG POSPUESTO

| Funcionalidad | Razón |
|---------------|-------|
| Build Lab / TTK Simulator | Alto mantenimiento por parche. Revaluar tras validar Team Tools. |
| Live Draft Mode | Alta complejidad de UX. Requiere Draft Board estable primero. |
| Clustering automático de equipos | Empezar con tags por reglas. Muestra insuficiente actualmente. |
| Item Armory avanzado | Alto mantenimiento. Dejar para V4. |
| Matchup Confidence % exacto | Sin modelo estadístico validado → usar Advantage/Risk en su lugar. |
| POV automático de replay | No hay soporte oficial. Usar VOD Index con links externos. |
| Pathing continuo de jugadores | No existe tracking de posición. Solo eventos puntuales. |
| IA generativa avanzada | Reglas primero. LLM solo para resumir evidencias trazables. |
| Colaboración multiusuario en tiempo real | Puede venir después. |
| Discord OAuth | Fase 2 de auth — después de validar login interno en producción. |

---

## Notas — Reportes diferenciados por tipo de usuario

**Equipos** (MANAGER / COACH / ANALISTA / JUGADOR):
- Scrim Report: inteligencia pre-partido, ban targets, win conditions
- Weekly Report: rendimiento del equipo, métricas colectivas
- Player Development: análisis de mejora individual dentro del equipo

**Jugadores individuales** (PLAYER sin equipo):
- Weekly Summary: KDA, GPM, DPM, WR, forma reciente — sin referencias a equipo
- Player Development autogenerado desde sus métricas históricas
- Sin Scrim Report (no hacen scrims contra equipos)

---

## Referencias
- `docs/future_features_roadmap.md` — roadmap priorizado
- `docs/react_crash_patterns.md` — diagnóstico y prevención de crashes React
- `docs/primesight_visual_design_direction.md` — sistema visual (colores, tipografía, tokens)
- `docs/predgg_api_inventory.md` — campos GraphQL disponibles en pred.gg
- `docs/workflow.md` — git workflow y convenciones
