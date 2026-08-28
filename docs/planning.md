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
- **La IA no es la fuente de verdad** — explica conocimiento versionado y evidencias trazables; no rellena huecos

## Tarea 32 — Coach adaptativo y progresión educativa
*Diseño detallado: `docs/adaptive_coach_knowledge_architecture.md`.*

### P0 — Conocimiento experto trazable
- [x] Separar evidencias personales (`E`) y conocimiento del juego (`K`) en el coach IA
- [x] Recuperar fundamentos MOBA por intención y rol
- [x] Añadir contexto sincronizado de héroes, objetos, Augmentos, Eternos y bendiciones
- [x] Mostrar fuentes y parche del conocimiento citado
- [ ] Banco de pruebas doradas sobre exactitud, límites y carga cognitiva
- [ ] Estado de cobertura/frescura del conocimiento en administración

### P1 — Diagnóstico y perfil pedagógico
- [ ] Competencias, nivel provisional, confianza e historial de evidencias
- [ ] Banco revisado de preguntas situacionales
- [ ] Diagnóstico inicial adaptativo de diez preguntas
- [ ] Profundidad y vocabulario del coach según nivel

### P2 — Aprendizaje activo
- [ ] Preguntas contextuales dentro del análisis de partida
- [ ] Respuestas con rúbrica contextual: adecuada, defendible, arriesgada o no evaluable
- [ ] Misiones personalizadas de tres a cinco partidas
- [ ] Replay y reflexión para decisiones no observables
- [ ] Repetición espaciada y validación de transferencia

### P3 — Ascensos y mejora del coach
- [ ] Prueba de ascenso combinando conocimiento, aplicación y reflexión
- [ ] Progresión independiente por competencia y resumen global educativo
- [ ] Panel de calidad del coach y dataset corregido/anonimizado
- [ ] Evaluar fine-tuning sólo si recuperación, reglas y prompt no resuelven errores repetidos

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
- [x] 151 tests en Vitest + Supertest (cobertura: players, teams, admin, auth, sync personal, reports, coaching, aggregates, map-zones, domain-engine)
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

## [x] Tarea 23 — B2C: Player Reports
Para jugadores individuales (PLAYER standalone).

- [x] `GET /reports/player-weekly/:playerId` — KDA semanal vs histórico, héroe más jugado, WR 7d vs 30d
- [x] Página `/reports/weekly` exclusiva para PLAYER standalone, con actualización manual de partidas
- [x] Player Development autogenerado desde métricas históricas (actividad, supervivencia, hero pool, momentum y consistencia)

## [x] Tarea 27 — Coach educativo de SoloQ
Primera iteración centrada en enseñar criterios transferibles sin convertir el análisis en una lista rígida ni en una pared de datos.

- [x] Historial personal independiente de la retención general y preservación de jugadores vinculados
- [x] TimescaleDB reproducible, compresión e índices para eventos temporales
- [x] Agregados propios de build, matchup e intervalos personales con muestra, fuente y confianza
- [x] Contrato educativo: evidencia, interpretación, práctica, excepción, ejemplos y límite del dato
- [x] Resumen de una prioridad, hasta dos focos secundarios y una fortaleza que conservar
- [x] Analysis dividido en resumen, build/loadout, habilidades, economía, combate/posición y objetivos/visión
- [x] Build, orden de compra, augment, Eternal y Blessings explicados en el contexto de la partida
- [x] Objetivo semanal evaluado al completar un ciclo de cinco partidas
- [x] Validación inicial con cinco partidas Ranked reales y degradación honesta cuando faltan datos
- [x] Momentos clave de replay: máximo tres ventanas con hecho, hipótesis, checklist, principio transferible y límite del dato
- [ ] Persistir la causa confirmada por el jugador y convertir patrones repetidos en objetivos personales

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
| ~~Colaboración multiusuario en tiempo real~~ | Promovido a Tarea 27 — ver issue #214 | — |
| **VOD Queue** | Playlist de clips seleccionados para revisar en sesión — reproductor integrado sin salir del modo | Baja |

---

## [ ] Tarea 27 — Tablero Táctico en Vivo (Live Session colaborativa)
*Prerequisito: PR #213/#215 (Playbook) mergeado ✅. Issue: #214.*

El coach inicia una sesión táctica en vivo desde Session Mode. Todos los miembros del equipo reciben una notificación en la app y pueden unirse al tablero en modo espectador (read-only, tiempo real). El coach puede dar control de edición a jugadores específicos. Reemplaza el screen sharing de Discord para el dibujo táctico.

### Backend
- [ ] Instalar `socket.io` en `apps/api`
- [ ] `apps/api/src/socket/board-socket.ts` — rooms por equipo, broadcast de elementos, gestión de presencia
- [ ] `apps/api/src/socket/ws-auth.ts` — middleware de autenticación sobre WebSocket (cookie de sesión)
- [ ] Attach `io` al HTTP server en `apps/api/src/index.ts`
- [ ] Prisma: modelo `BoardSessionGrant` (teamId, grantedByUserId, grantedToUserId, revokedAt)
- [ ] Endpoints REST: `POST /session-grants`, `DELETE /session-grants/:id`
- [ ] Estado del board en memoria: `Map<teamId, BoardElement[]>` — late joiners reciben `board:sync`

### Eventos WebSocket

| Cliente → Servidor | Descripción |
|-------------------|-------------|
| `board:join` | Unirse al room del equipo |
| `board:elements` | Emitir estado completo del canvas |
| `session:start` | Coach inicia sesión (notifica a todos los miembros) |
| `session:end` | Coach termina la sesión |
| `grant:give` | Coach da control de edición a un userId |
| `grant:revoke` | Coach revoca el control |

| Servidor → Cliente | Descripción |
|-------------------|-------------|
| `board:sync` | Estado actual al unirse (late joiners) |
| `board:elements` | Broadcast de cambios del canvas |
| `session:started` | Notificación global a miembros del equipo |
| `session:ended` | Sesión terminada |
| `grant:created` | Notificación al jugador que recibe control |
| `grant:revoked` | Notificación al jugador que pierde control |
| `presence:update` | Lista de usuarios conectados en el room |

### Frontend
- [ ] Instalar `socket.io-client` en `apps/web`
- [ ] `apps/web/src/contexts/SocketContext.tsx` — socket global que persiste entre páginas
- [ ] `apps/web/src/hooks/useSocket.ts` — hook para acceder al socket
- [ ] `App.tsx` — wrap con `SocketProvider` + listeners globales `session:started` / `grant:created` → toast con CTA
- [ ] `TacticalBoardCanvas.tsx` — prop `sessionTeamId` activa modo colaborativo: emite `board:elements` en cada `commitElements`, aplica updates remotos (sin echo propio)
- [ ] `TacticalBoard.tsx` — banner "En vivo", conecta al room si hay sesión activa o grant
- [ ] `SessionMode.tsx` — botón Iniciar/Terminar sesión, panel de presencia, botón Dar/Revocar control por jugador del roster

### UX — roles en sesión

| Rol | Experiencia |
|-----|-------------|
| Coach (host) | Dibuja libremente, ve presencia, gestiona control |
| Player (espectador) | Canvas read-only actualizado en tiempo real, banner "En vivo" |
| Player (con control) | Toolbar visible, puede dibujar, coach ve sus cambios |

---

## [x] Tarea 28 — Sistema de Misiones y Logros (onboarding gamificado)
*Issue: #218. PRs #226, #227. Desplegado en producción (2026-05-29).*

Catálogo estático de misiones por rol. Completions y logros en BD (`UserMissionCompletion`, `UserAchievement`). WelcomeModal en primera entrada. Panel «Primeros pasos» en Dashboard. Hooks fire-and-forget en rutas existentes. PLATFORM_ADMIN puede previsualizar misiones por rol con `?role=`.

**Misiones por rol (final):**
- **COACH (8):** Completa perfil · Vincula pred.gg · Programa primer scrim · Crea entrada Playbook · Scout rival · Completa sesión de revisión · Usa Tablero Táctico · Revisa insights
- **MANAGER (6):** Completa perfil · Vincula pred.gg · Crea tu equipo · Invita un miembro · Completa perfil del equipo · Revisa rendimiento del equipo
- **ANALISTA (6):** Completa perfil · Vincula pred.gg · Analiza un jugador · Crea ítem de revisión · Completa tu primer análisis · Revisa insights
- **JUGADOR (6):** Completa perfil · Vincula pred.gg · Consulta tu perfil · Objetivo semanal · Revisa hero pool · Consulta rendimiento del equipo
- **PLAYER (6):** Completa perfil · Vincula pred.gg · Consulta tu perfil · Objetivo semanal · Revisa hero pool · Busca un jugador

Formulario «Nuevo ítem de revisión» añadido en ReviewQueue para que el analista complete la misión `CREATE_REVIEW_ITEM` de forma natural (PR #227).

## [x] Tarea 29 — Team Hub (gestión unificada de equipos)
*PRs #226–#235. Desplegado en producción (2026-05-30).*

`/management/teams` sustituye a TeamRoster + StaffManagement. Lista de equipos con badge de rol; detalle con secciones Staff, Jugadores y Roster pred.gg. Cambio de rol inline para MANAGER. Panel de invitaciones. Creador queda automáticamente como MANAGER. COACH puede gestionar roster.

**Mejoras adicionales (2026-05-30):**
- Roles adicionales al crear equipo (COACH/ANALISTA/JUGADOR) → guardados en `TeamMembership.extraRoles`
- Invitar usuario sin equipo desde `/admin/users` — modal con email, rol y equipo opcional; soporte para PLATFORM_ADMIN sin equipo
- Panel de invitaciones en administración (`/admin/invitations`) — todas las invitaciones de la plataforma con filtro y revocación
- Panel de Roles y Permisos reorganizado: 13 secciones, 6 roles (PLAYER standalone añadido), nuevas claves para Playbook/Scrim Planner/Review Sessions/Tactical Board
- Lista de partidas con filtro por equipo rival — `rivalTeamName` cruzando `ScrimSchedule` con UUID de pred.gg
- Vista de partidas personales para PLAYER (`/player/matches`) — historial desde pred.gg con KDA, héroe, resultado, duración
- Token central de pred.gg: el servidor comprueba cada 5 min el access token y solo utiliza el refresh token cuando está próximo a caducar

## [x] Tarea 30 — Infraestructura OAuth pred.gg
*PRs #235–#245. Desplegado en producción (2026-05-31).*

- Gestor central de token: una única credencial rotatoria en PostgreSQL, acceso cacheado y persistido, exclusión mutua local + advisory lock entre procesos
- Keep-alive cada 5 min: `startTokenKeepAlive()` comprueba el acceso, pero solo contacta con pred.gg cuando el access token está próximo a caducar
- Banner de estado del token en Data Quality: verde/rojo/amarillo con botón «Reconectar pred.gg»
- `platformTokenState` actualizado inmediatamente al reconectar OAuth (callback + event stream sync)
- CI/CD mejorado: build frontend en CI, health check post-deploy (6 reintentos × 5s), rollback automático si falla
- Fix: `region { name }` → `region` en live match query (pred.gg cambió schema)
- Fix: `nav.invitations` y 12 claves `common.*` añadidas a locales (bloqueaban el build del frontend desde el 29/mayo)

## [x] Tarea 31 — Analyst Insights Batch 2 — 20 reglas individuales
*PR #245. Desplegado en producción (2026-05-31).*

20 nuevas reglas de análisis individual (solo para equipos OWN). Pendiente en `docs/primesight_indicators_catalog_batch2.md`.

**Riesgo y muertes (event stream):**
- `rule-first-death-rate` · `rule-early-death-rate` · `rule-death-before-obj-player`

**Visión individual:**
- `rule-low-vision-share` · `rule-low-ward-clear-share` · `rule-vision-drop` · `rule-positive-vision-improvement`

**Objetivos y estructuras** (`totalDamageDealtToObjectives/Structures`):
- `rule-low-objective-dmg-share` · `rule-low-structure-dmg-share` · `rule-no-objective-impact-after-lead`
- `rule-high-objective-impact` ✅ · `rule-high-structure-pressure` ✅

**Eficiencia y recursos:**
- `rule-high-gold-low-kp` · `rule-high-gold-high-death` · `rule-positive-efficiency` ✅

**Farm y economía por rol:**
- `rule-low-cs-role` · `rule-cs-drop` · `rule-positive-farm-consistency` ✅

**Hero pool y draft:**
- `rule-low-hero-pool-depth` · `rule-comfort-overreliance`

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

## [x] Tarea 19 — Team Tools: Scrim Planner, Playbook, Review Sessions
*Completada. PR #195, #210, #211, #213, #215, #219, #220, #221, #222, #223, #224. Issue #217 cerrado.*

- [x] **Scrim Planner** — `ScrimPlanner.tsx` + backend `ScrimSchedule` + migraciones. CRUD completo: crear scrim, vista lista, filtros por tipo (SCRIM/OFICIAL/ENTRENAMIENTO/TORNEO), estado (PENDIENTE/CONFIRMADO/CANCELADO), notas y resultado. (PR #195)
- [x] **Post-match tasks** — 3h tras el inicio, ANALISTA ve «Análisis pendientes» y COACH ve «Revisiones pendientes» en Dashboard. Botón ✓ Hecho por tarea. (PR #210 / #211)
- [x] **Auto-detección de resultado** — worker `detect-results` cruza el roster del equipo con historial de pred.gg. Si ≥3 jugadores comparten un match UUID en ventana [scheduledAt-30min, +3h] → WIN/LOSS automático + enlace a pred.gg en ScrimPlanner. (PR #210 / #211)
- [x] **Cron detect-results en producción** — `30 * * * *` en Hetzner, log en `/var/log/riftline-detect-results.log`
- [x] **Playbook** — biblioteca táctica: entradas por categoría/fase/rol, pin, edición inline, mapa táctico embebido (PR #213 / #215)
- [x] **Review Sessions** — sesiones organizadas con agenda y action items. Modelos `ReviewSession`, `AgendaItem`, `ActionItem`. (PR #219, issue #217)
  - Agenda con checkmarks, timestamps VOD, ref. jugador, orden configurable
  - Action items con ciclo de estado (Abierto → En progreso → Completado), asignee, fecha límite
  - Sesiones agrupadas por estado: En curso / Pendientes / Completadas
  - Vinculación opcional a scrim del Scrim Planner
- [x] **Flujo automático post-partida** — al detectar resultado: TeamComm urgente a ANALISTA + normal a COACH. Al marcar análisis como ✓ Hecho: genera `ReviewSession` con hasta 8 agenda items desde insights (CRITICAL→HIGH→MEDIUM), notifica al COACH. Dashboard muestra "⏳ Analizando…" y toast con link directo. (PR #219)
- [x] **Rival Roster scouting** — búsqueda de jugadores rivales en pred.gg (via Bearer token) + roster persistente por equipo rival (`RivalRosterEntry`). Sección expandible "Rival Lineup" en ScrimCard. Creación de equipo rival inline desde ScrimPlanner ("+ Nuevo rival"). Al añadir un jugador: sync completo de pred.gg (`syncPlayerById` — rank, stats, hero pool, 50 partidas) + upsert automático en `TeamRoster` del equipo RIVAL → habilita análisis rival pre-partido en Analysis → Teams. Al eliminar: soft-delete en `TeamRoster`. (PR #221, #223, #224)

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
| ~~Colaboración multiusuario en tiempo real~~ | Promovido a Tarea 27 — ver issue #214 |
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
