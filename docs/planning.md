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

## [x] Tarea 26 — Dashboard operacional, Recruiting Scouting y Live Match (PR #195)
*Extensión de funcionalidades operacionales para staff de equipo y scouting en tiempo real.*

### Dashboard operacional por rol
- [x] Panel **Scrim Calendar** (MANAGER/COACH) — vista de próximos scrims con acceso directo a ScrimPlanner
- [x] Panel **Coach Comms** (COACH) — buzón de comunicaciones internas del equipo
- [x] Panel **Weekly Goals** (JUGADOR standalone) — progreso semanal de objetivos personales
- [x] Panel **Roster Form** (MANAGER) — estado actual del roster con rosterStatus (STARTER/BENCH)

### Recruiting Scouting
- [x] `GET /players/:id/scout` — perfil de scouting: stats agregados, héroes, alertas, compatibilidad
- [x] `PlayerScouting.tsx` refactorizado como **Recruiting Scorecard** — sin lista de partidas, datos live de pred.gg
- [x] Sync solo para jugadores de equipos OWN (`POST /players/sync` modificado)

### Live Match viewer
- [x] `GET /matches/live/:predggUuid` — proxy de pred.gg para ver partida en curso (sin persistencia en BD)
- [x] Ruta `/matches/live/:predggUuid` en App.tsx con `<MatchDetail liveMode />`
- [x] `MatchDetail` en liveMode: spinner "Preparando informe…", sin botón sync/rename, eventos preloaded
- [x] Timeline y Analysis tabs usan `preloadedEvents` cuando viene de liveMode (evita segundo fetch)

### Schema
- [x] `ScrimSchedule` — calendario de scrims/partidas oficiales por equipo
- [x] `WeeklyGoal` — objetivos semanales para jugadores standalone
- [x] `TeamComm` — comunicaciones internas (coach → analista, anuncios de manager)
- [x] `TeamRoster.rosterStatus` — STARTER | BENCH
- [x] `User.language` — preferencia de idioma (en | es)
- [x] `Team.academyOf` — relación de academia entre equipos OWN
- [x] `Invitation.teamId` nullable — invitaciones JUGADOR sin equipo asignado

### Backend routes
- [x] `GET|POST|PATCH|DELETE /schedule` — CRUD de ScrimSchedule
- [x] `GET|POST|PATCH /weekly-goals` — CRUD de WeeklyGoal
- [x] `GET|POST|PATCH /comms` — CRUD de TeamComm
- [x] `POST /admin/cleanup-non-team-data` — purga datos de jugadores sin equipo

## [x] Tarea 22 — Infraestructura: despliegue y retención de datos
- [x] Saneamiento de DB: borrado de datos anteriores a Feb 2026 + jugadores inactivos + QA seed
- [x] Sistema de retención configurable (`DATA_RETENTION_MONTHS`, por defecto 3)
- [x] `cleanupOldData()` en sync-service — borra event stream + matches + jugadores inactivos
- [x] Endpoint `POST /admin/cleanup-non-team-data` para ejecución manual (y retención mensual automática)
- [x] Cron mensual automático (día 1, 03:00h) con `node-cron`
- [x] Filtro de retención en sync: `syncRecentMatchesForPlayer` solo para jugadores de equipos OWN
- [x] API sirve el frontend estático en producción (single service)
- [x] Migración de assets a `apps/web/public/` (servidos por Vite directamente)
- [x] **Despliegue activo en Hetzner** — servidor `riftline.app`, CI/CD vía GitHub Actions + SSH, PM2 + tsx
- [x] CI/CD fix: `rm -rf ~/.cache/tsx` antes del restart de PM2 (tsx servía código cacheado en deploys)

---

# BLOQUE B — EN CURSO / PRÓXIMO

## [x] Tarea 9 — Analyst: LLM (Claude API)
*Prerequisito: Tarea 8 completa y validada en producción.*

- [x] Prompt caching para contexto del juego (system prompt fijo con reglas de Predecessor)
- [x] Streaming SSE al frontend → "Focus of the Day" en Dashboard
- [x] AI Summary: LLM resume insights ya calculados, no inventa causalidad
- [x] Coste estimado: <$0.01 por análisis con claude-sonnet-4-6
- [x] **API key configurable desde la web** — `PlatformConfig.llm_api_key` (masked con `__SET__`); fallback a `OPENROUTER_API_KEY` env var; campo password en ConfigPage con badge CONFIGURADA/NO CONFIGURADA (PR #202)
- [x] **i18n insights (Tarea 9B)** — `insight-strings.ts` como única fuente de verdad para EN/ES; `analyst-service.ts` acepta `lang` param; frontend pasa `i18n.language`; ver `docs/reglas_insights_automaticos.md` para el workflow de añadir nuevos insights
- [x] **i18n frontend completo** — todos los ficheros de traducción EN/ES migrados; 6 páginas pendientes completadas (ApiStatusPage, AuditLogsPage, ConfigPage, FeedbackPage, PermissionsPage, TeamAnalysis)
- [x] **Invitaciones sin equipo** — `Invitation.teamId` nullable; PLATFORM_ADMIN puede crear invitaciones JUGADOR sin teamId; registro crea `globalRole: 'PLAYER'` cuando no hay teamId
- [x] **Dashboard manager sin equipo** — `ManagerNoTeamPrompt` cuando `isManagerWithNoTeam`; link a `/analysis/teams`
- [x] **Migraciones SQL** — ficheros en `workers/data-sync/prisma/migrations/` para `rosterStatus`, `User.language`, `Invitation.teamId` nullable y `PlatformConfig llm_api_key`; listas para `prisma migrate deploy` en producción

---

## [x] Tarea 14 — Team Tools: Tactical Board (PR #207 / PR #208)
Pizarra interactiva sobre el mapa de Predecessor.

- [x] Canvas HTML5 interactivo sobre mapa real de Predecessor (1116×1200px con overlay)
- [x] Herramientas: seleccionar · lápiz · línea · flecha · texto · elipse · rectángulo
- [x] Tokens de rol (carry/jungle/mid/offlane/support) — icono sin fondo, anillo de equipo
- [x] Toggle equipo: **Propio** (azul) / **Rival** (rojo) / Neutro — color del anillo
- [x] Doble clic en token → popup asignar jugador del roster + héroe
- [x] Wards de visión (👁) y control (🔮)
- [x] Shortcuts teclado: V · P · L · A · T · C · R · Delete · Ctrl+Z · Esc
- [x] Undo/redo (40 pasos), clear all, export PNG
- [x] Ruta propia `/tools/board` + integración en Session Mode (compact mode)
- [x] ResizeObserver fix: canvas `position:absolute; inset:0` sin layout-affecting height
- [x] Sin Konva.js — incompatible con React 19 (`ReactDOM.findDOMNode` deprecated)

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

## [x] Tarea 24 — Coach Session Mode (PR #197 / PR #208)
Vista limpia para proyectar en Discord/stream interno.

- [x] Vista general: próximo partido, alertas críticas, Focus of the Day (SSE), objetivos del equipo
- [x] Sin distracciones de navegación — fullscreen nativo
- [x] Acceso rápido desde header para MANAGER/COACH
- [x] Tablero táctico integrado (TacticalBoardCanvas compact) — herramientas completas de dibujo
- [x] Roster: roster activo del equipo ordenado por rol con rating
- [x] Calendario: todos los partidos programados con estado pasado/futuro
- [x] Nav de tabs colapsable (botón ☰) para proyección limpia

### Secciones futuras para Session Mode (issue #201)

Secciones identificadas con alto valor para sesiones de equipo:

| Sección | Descripción | Prioridad |
|---------|-------------|-----------|
| **Draft Board** | Picks/bans interactivo — arrastrar heroes, marcar bans, simular drafts contra un rival | Alta |
| **Battle Plan** | Notas tácticas estructuradas para el próximo partido: win conditions, ban targets, estrategias por fase | Alta |
| **Heatmap del mapa** | Visualización de eventos (kills, objectives) sobre el mapa de Predecessor para análisis en sesión | Media |
| **Comparativa de stats en vivo** | Tabla lado a lado: métricas propias vs rival del partido anterior para el briefing pre-partido | Media |
| **Timer de objetivos** | Temporizadores manuales para Shaper, Seedlings, estructuras — para practicar rotaciones | Media |
| **Pizarra de notas compartida** | Texto libre sincronizado en tiempo real (WebSockets) — visible en múltiples pantallas del equipo | Baja |
| **VOD Queue** | Playlist de clips seleccionados para revisar en sesión — reproductor integrado sin salir del modo | Baja |

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

## [~] Tarea 19 — Team Tools: Scrim Planner, Playbook, Review Sessions

- [x] **Scrim Planner** — `ScrimPlanner.tsx` + backend `ScrimSchedule` + migraciones. CRUD completo: crear scrim, vista lista, filtros por tipo (SCRIM/OFICIAL/ENTRENAMIENTO/TORNEO), estado (PENDIENTE/CONFIRMADO/CANCELADO), notas y resultado. (PR #195)
- [x] **Post-match tasks** — 3h tras el inicio, ANALISTA ve «Análisis pendientes» y COACH ve «Revisiones pendientes» en Dashboard. Botón ✓ Hecho por tarea. (PR #210 / #211)
- [x] **Auto-detección de resultado** — worker `detect-results` cruza el roster del equipo con historial de pred.gg. Si ≥3 jugadores comparten un match UUID en ventana [scheduledAt-30min, +3h] → WIN/LOSS automático + enlace a pred.gg en ScrimPlanner. (PR #210 / #211)
- [ ] **Cron detect-results en producción** — configurar `30 * * * * node .../index.js detect-results` en Hetzner
- [ ] **Playbook** — biblioteca de estrategias, setups y reglas tácticas del equipo
- [ ] **Review Sessions** — sesiones organizadas con agenda, boards y action items

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
