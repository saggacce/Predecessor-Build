# Planning del proyecto

Tablero simple de tareas generales y subtareas.

Referencias de producto:
- `docs/PrimeSight_Especificacion_Producto_Analitica_v3.pdf`
- `docs/PrimeSight_Team_Tools_Analysis_Tools_Discord_Bot.md`

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

## Flujo de valor central
```
Datos de partida → eventos críticos → review → objetivos → mejora medible
```

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
- [x] 100 tests en Vitest + Supertest (cobertura: players, teams, admin, auth, map-zones, domain-engine)
- [x] CI/CD GitHub Actions + branch protection en main
- [x] Tests de agregación de métricas de jugador (PR #47)
- [x] Tests de filtros por parche/ventana temporal (PR #47)

## [x] Tarea 5 — Gestión de jugadores
- [x] `customName` — API PATCH + UI inline edit + display logic en toda la app
- [x] Logo de equipo (upload base64 + URL)
- [ ] Sync worker: crear `Player` para todos los UUIDs del event stream sin nombre

## [x] Tarea 6 — Analysis Tools: Match Detail e indicadores
### [x] 6A — Scoreboard completo (PR #40)
### [x] 6B — Statistics tab (16 campos extendidos: daño P/M/T, CS, healing, highlights)
### [x] 6C — Event stream sync (HeroKill, ObjectiveKill, StructureDestruction, WardEvent, Transaction, HeroBan)
### [x] 6D — Timeline tab (swim lanes, zoom, tooltips, minimapa calibrado con MAP_BOUNDS)
### [x] 6E — Analysis tab (Objective Control, Gold Diff, Deaths Before Objective, Heatmap)
### [x] 6F — Indicadores del catálogo (PR #44)
- [x] Statistics tab: /min rates (IND-009/012/013/014/015/016), participation shares (IND-003/004/008)
- [x] Heatmap: structures (HM-011), pre-obj deaths (HM-002), prime conv (HM-012), teamfights (HM-013), role filter (HM-014)
- [x] Team Analysis backend: TEAM-002/003/004/012/016/017 + IND-036 (early death rate)

---

# BLOQUE B — EN CURSO / PRÓXIMO

## Tarea 7 — Build/Stat module [~POSPUESTO]
*Revaluar tras validar Review Queue y Team Tools con usuarios reales.*
*Hero base stats disponibles en pred.gg via `hero.data.attributes` cuando se necesiten.*

---

## [x] Tarea 8 — Analyst: Rules Engine
Motor determinista. 9 reglas implementadas. Sin LLM.

- [x] `GET /analysis/insights/:teamId` → lista ordenada por severidad (`apps/api/src/services/analyst-service.ts`)
- [x] Reglas: muerte crítica pre-objetivo, baja visión, visión limpiada, prime no convertido, draft dependency, throw pattern, player slump, vision gaps, reinforcement positivo
- [x] Data Status insight — distingue "datos de jugador OK" vs "event stream pendiente"
- [x] Panel "Analyst" en TeamAnalysis con InsightCard (severity badge, evidencia colapsable, botón Review)
- [ ] Umbrales configurables por coach (pendiente)

---

## Tarea 9 — Analyst: LLM (Claude API)
*Prerequisito: Tarea 8 completa y validada.*

- [ ] Prompt caching para contexto del juego (system prompt fijo con reglas de Predecessor)
- [ ] Streaming SSE al frontend → "Focus of the Day" en Dashboard
- [ ] AI Summary: LLM resume insights ya calculados, no inventa causalidad
- [ ] Coste estimado: <$0.01 por análisis con claude-sonnet-4-6

---

## [x] Tarea 10 — Team Tools: Review Queue y flujo de entrenamiento

- [x] Modelos `ReviewItem`, `TeamGoal`, `PlayerGoal` en schema.prisma
- [x] `GET/POST/PATCH/DELETE /review/items` — cola con filtros por status/priority
- [x] `GET/POST/PATCH/DELETE /review/goals/team/:teamId`
- [x] `GET/POST/PATCH /review/goals/player/:teamId`
- [x] Página Review Queue con 2 tabs: Review Queue + Team Goals (KPI strip, filtros, inline edit)
- [x] 8 estados de ReviewItem, 8 tags manuales de causa
- [x] Player Goals UI — panel inline en PlayerScouting (PR #95, issue #77, [Codex])
- [ ] Vincular Review Item → Team/Player Goal desde la UI

---

## [x] Tarea 11 — UI/UX V2: mejoras de calidad (PR #89, #91, issue #63)
Mejoras basadas en el Documento Maestro V2 y el audit visual.

### Quick wins (datos ya disponibles, cambios pequeños)
- [x] Colores OWN (cian) / RIVAL (rojo) stripe en lista de equipos (PR #89)
- [x] Hover iluminado en filas de Team Analysis (PR #89)
- [x] Separar icono Delete del icono Edit — gap aumentado (PR #89)
- [x] "Last 20" en verde si WR reciente > histórico, rojo si menor (PR #89)
- [x] Barras de progreso detrás de GPM/DPM en Player Comparison (PR #91)
- [x] Pocket Pick Highlight — borde dorado en héroes con <10 partidas pero >65% WR (PR #89)
- [x] Quick Report button en header de equipos RIVAL → pre-selecciona en ScrimReport (PR #91)
- [x] Sticky header en tabla Player Comparison (PR #91)
- [x] One-Trick Alert: icono Target rojo en rivals con ≥50% partidas en un héroe (PR #89)
- [ ] Status Badges en equipos: "Incomplete Roster" (<5 jugadores), "Performance Drop"

### Dashboard
- [x] "Pulse Server" — LED con animación ledPulse cuando API online (PR #89)
- [ ] Widget de resumen de equipo propio (WR reciente, últimas partidas)
- [ ] Sustituir métricas de vanidad por Objective Success %, Vision Consistency

### Battle Plan (ScrimReport mejorado)
- [x] Visual VS con logos de ambos equipos (PR #94, issue #58)
- [x] Intelligence Notes divididas por categoría: ⚠️ alertas / 💡 oportunidades / 🎯 banos (PR #94)
- [x] Win Conditions prescriptivas desde rival scouting (PR #94)
- [x] Modo Full Screen para proyectar en sesiones de vídeo (PR #94)

### Coach Session mode
- [ ] Vista limpia para proyectar en Discord/stream interno: Battle Plan + 3 insights clave + objetivos de sesión

---

## [~] Tarea 12 — Pre-Match Intelligence: Battle Plan prescriptivo
*Parcialmente implementada dentro de ScrimReport (PR #94). Lo pendiente es el modo Battle Plan autónomo.*

- [x] Selector VS con logos de ambos equipos (en ScrimReport, PR #94)
- [x] Win Conditions prescriptivas desde rival scouting data (en ScrimReport, PR #94)
- [x] Target Players — amenazas por rol con threat score (en `/analysis/rival`, PR #93)
- [x] Objective Plan — control por objetivo con timing medio (en `/analysis/rival` y ScrimReport)
- [ ] Filtro de timeframe (últimas N partidas / parche actual)
- [ ] **Avoid List** — zonas de mapa con ratio K/D desfavorable (requiere Tarea 13 + event stream)
- [ ] **Roster Validator** — aviso si el rival ha jugado con suplentes recientes (`TeamRoster.activeFrom`)

---

## [x] Tarea 13 — Zonas tácticas del mapa (PR #83, issue #52)
Sin polígonos definidos, ~15 indicadores del catálogo no son calculables.

- [x] Definir polígonos manualmente sobre el mapa calibrado (MAP_BOUNDS ya conocidos)
- [x] 11 zonas calibradas desde coordenadas reales de ObjectiveKill: `FANGTOOTH_PIT`, `FANGTOOTH_ENTRANCES`, `MINI_PRIME_PIT`, `ORB_PRIME_PIT`, `SHAPER_PIT`, `MID_LANE`, `DUO_LANE`, `OFFLANE`, `OWN_JUNGLE`, `ENEMY_JUNGLE`, `RIVER_BUFF_AREAS`
- [x] Tabla `MapZone` en schema.prisma + `GET /map-zones` + `POST /map-zones/seed` (idempotente)
- [x] `pointInZone(x, y, polygon)` ray casting O(n) en `domain-engine/src/map-zones.ts`
- [x] 8 tests de correctness en `map-zones.test.ts`

---

## Tarea 14 — Team Tools: Tactical Board (pizarra táctica)
Pizarra interactiva sobre el mapa de Predecessor. Uso libre o vinculada a partida/rival.
*No es un replay. No infiere posiciones. Solo planificación visual.*

### Modelo de datos
- [ ] Tabla `TacticalBoard`: `{ id, teamId, matchId?, rivalId?, title, createdBy, visibility }`
- [ ] Tabla `BoardObject`: `{ id, boardId, objectType, x, y, x2?, y2?, label, color, icon, metadata }`

### Tipos de objeto en el board
`ally_player` · `enemy_player` · `ward` · `danger_zone` · `engage_point` · `rotation_arrow` · `objective_setup` · `reset_point` · `do_not_fight` · `priority_area` · `review_marker` · `text_note`

### Funciones MVP
- [ ] Crear tablero vacío sobre el mapa
- [ ] Añadir markers, texto, flechas y zonas
- [ ] Guardar y cargar tablero
- [ ] Asociar tablero a match / equipo / rival
- [ ] Duplicar tablero para crear variantes
- [ ] Exportar como imagen
- [ ] Usar coordenadas normalizadas (MAP_BOUNDS)

### Casos de uso prioritarios
Fangtooth setup · Shaper setup · Prime defense · Corrección de error con anotación · Preparación de rival

### Librería recomendada
Konva.js (canvas con React) — soporta layers, drag, export a imagen

---

## Tarea 15 — Team Tools: Tactical Timeline (review con anotaciones)
*Diferente al Timeline tab actual.* El Timeline tab es inspección individual de una partida. Este módulo es para sesiones de review de equipo con anotaciones, filtros por objetivo y creación de review items.
*Prerequisito: Tarea 10 activa.*

### Diferencias con el Timeline tab actual
| Timeline tab (actual) | Tactical Timeline (nuevo) |
|-----------------------|--------------------------|
| Inspección individual | Review de equipo |
| Solo lectura | Permite anotar y crear review items |
| Sin filtro por objetivo cercano | Filtro "antes de Fangtooth/Prime/Shaper" |
| Sin Event Feed lateral | Feed lateral con contexto por evento |

### Funciones MVP
- [ ] Cargar partida por Match ID
- [ ] Eventos sobre mapa con slider temporal
- [ ] Event Feed lateral: gameTime, eventType, player, hero, context, priority
- [ ] Filtros: equipo, evento, rol, jugador, fase, objetivo cercano, ventana (30/60/90/120s)
- [ ] Crear Review Item desde evento
- [ ] Añadir anotación de coach a evento
- [ ] Guardar sesión asociada a match

### Limitaciones (comunicar en UI)
- No hay posición continua de jugadores
- No infiere rutas reales
- No sustituye el replay del juego
- Solo representa eventos conocidos de la API

---

## [x] Tarea 16 — Team Tools: VOD & Replay Index (PR #90, issue #56, [Codex])
Índice de enlaces externos. No reproducir vídeo dentro de PrimeSight.

- [x] Modelo `VodLink` en schema.prisma: id, matchId, playerId?, teamId, type, url, timestamps, tags, notes, visibility
- [x] `GET/POST/PATCH/DELETE /vod` — CRUD completo
- [x] Página `VodIndex.tsx` — lista, añadir/editar/borrar VOD link, filtros por tipo y jugador
- [x] Botón "Open at timestamp" (abre YouTube/Twitch en el momento justo)

---

## [x] Tarea 17 — Auth: RBAC, invitaciones y perfiles de usuario

### Fase 1 — Completada (PR #66 + #68 + #85 + #87)
- [x] Modelos `User`, `TeamMembership`, `Invitation` en schema.prisma
- [x] `POST /internal-auth/login` — bcrypt 12, JWT 1h en cookie httpOnly, refresh token 30d
- [x] `POST /internal-auth/register` — registro por invitation token, transacción atómica
- [x] `POST /internal-auth/refresh` — rota sesión desde refresh cookie
- [x] `GET /internal-auth/me` — sesión actual
- [x] `POST/GET/DELETE /invitations` — gestión de invitaciones (solo MANAGER o PLATFORM_ADMIN)
- [x] Middleware `requireAuth` + `requireRole(roles[])` + `requirePlatformAdmin` para proteger rutas
- [x] `requireAuth` aplicado a todas las rutas sensibles (admin, analyst, matches, players, reports, review, teams) — PR #87, issue #76
- [x] Security hardening: rate limiting (10 intentos/15min), timing attack fix, cookie secure en prod, audit log en SyncLog
- [x] Roles globales: `PLATFORM_ADMIN` | `VIEWER`
- [x] Roles por equipo: `MANAGER` | `COACH` | `ANALISTA` | `JUGADOR`
- [x] UI de login/registro/gestión de usuarios — Login, Register, StaffManagement, `useAuth` extendido con `internalAuthenticated` + `refreshInternalSession` — PR #85, issue #73
- [ ] Discord OAuth (Fase 2)
- [ ] Tiers de monetización (Fase 2)

---

## [x] Tarea 20 — Backend Analytics: catálogo de métricas (coach/analista)
Implementación de los indicadores verdes del catálogo `PrimeSight_metric_catalog_full.csv` revisado por coach y analista externo.

- [x] `GET /teams/:id/phase-analysis` — Kill Diff @10/15, Objective Diff @10/15/20, Throw Rate, Comeback Rate (`team-service.ts`)
- [x] `GET /teams/:id/vision-analysis` — Vision Control Score, Vision Before Objective (por tipo), Jungler/Support Alive Before Objective, Objective Lost/Taken After Death, Vision Lost Before Objective (`team-service.ts`)
- [x] `GET /teams/:id/objective-analysis` — Conversiones detalladas (→estructura/inhibidor/core) por Fangtooth/Shaper/Prime/Mini, Timing Consistency (stddev), Priority Share (`team-service.ts`)
- [x] `GET /teams/:id/draft-analysis` — Pick rates, Ban rates propio/recibido (RANKED), Hero Pool Depth, Comfort Score, Hero Pool Overlap (`team-service.ts`)
- [x] `GET /players/:id/advanced-metrics` — Gold/Damage/Kill Share %, Efficiency Gap, First Death Rate, Early Death Rate individual (`player-service.ts`)
- [x] `GET /teams/:id/rival-scouting` — Identity labels (Early Aggressor, Objective Focused…), form reciente, strongPhase/weakPhase, Threat Players con threatScore, weakRole, objectivePriority — PR #86

### Nueva arquitectura de menús (doc coach/analista)
Restructura completa de navegación definida en `PrimeSight_menu_distribution.md` y `PrimeSight_metric_catalog_full.csv`. 8 secciones principales: Dashboard, Matches, Analysis, Team Tools, Reports, Discord Bot, Team Management, Platform Admin.
- [x] Implementada en `App.tsx` — sidebar acordeón con 8 secciones, backward-compat redirects — PR #81, issue #72
- [x] Phase/Vision/Objective Analysis tabs en TeamAnalysis — PR #74, issue #74 [Codex]
- [x] Player Advanced Metrics UI en PlayerScouting (Gold/Damage/Kill Share, Efficiency Gap, Death Rates) — PR #92, issue #75 [Codex]
- [x] Player Goals UI en PlayerScouting — PR #95, issue #77 [Codex]
- [x] Draft Analysis UI en TeamAnalysis (picks, bans, hero pool, overlap) — PR #79 [Codex, en curso]
- [x] Rival Scouting frontend `/analysis/rival` (identity, form, threat players, objectives) — PR #93

### Platform Admin
- [x] Panel completo con 3 tabs: Staff & Invitations, Data Controls, Audit Logs — PR #96, issue #78

---

## Tarea 18 — Discord Companion Bot
*Prerequisito: Tarea 8 (insights) + Tarea 10 (review items) activas. El bot consume datos procesados, no calcula nada.*

### Arquitectura
```
pred.gg API → PrimeSight Backend → Analytics Engine → Notification Service → Discord Bot
```

### Modelo de datos
- [ ] Tabla `DiscordIntegration`: `{ id, guildId, teamId, enabled, createdBy }`
- [ ] Tabla `DiscordChannelConfig`: `{ id, integrationId, channelType, channelId, enabled }`
- [ ] Tabla `NotificationRule`: `{ id, teamId, ruleType, enabled, threshold, channelType }`

### Funciones MVP (Fase 1)
- [ ] Vincular servidor Discord con equipo de PrimeSight
- [ ] Configurar canales por tipo (alerts, match-reports, review-queue, team-goals, scouting)
- [ ] Enviar resumen de partida al importar (resultado, duración, alertas críticas, botones a PrimeSight)
- [ ] Enviar Review Alert cuando `severity: critical` (gameTime, evento, contexto, botones)
- [ ] `/primesight match <match_id>` — consultar partida
- [ ] `/primesight review pending` — ver cola de revisión pendiente
- [ ] `/primesight report last-match` — último reporte del equipo
- [ ] Permisos mínimos: Send Messages, Embed Links, Use Slash Commands — **sin Administrator**

### Canales recomendados
`#primesight-alerts` · `#match-reports` · `#review-queue` · `#team-goals` · `#scouting-reports`

### Funciones Fase 2 (cuando el core esté estable)
- [ ] Weekly team goal summary (progreso vs objetivo)
- [ ] Scouting report resumido antes de scrims
- [ ] `/primesight matchup <our_team> <rival_team>`
- [ ] DM a jugador con objetivo individual sensible

### Reglas de diseño
- Agrupar alertas para evitar spam
- Solo eventos críticos por defecto
- La web debe funcionar completamente sin el bot
- Configuración por equipo (opt-in por canal)

---

## Tarea 19 — Team Tools: Scrim Planner, Draft Board, Playbook, Review Sessions
*Fase 3/4. Construir cuando Review Queue y Team Goals estén validados por usuarios reales.*

- [ ] **Scrim Planner** — planificador de scrims con focus area vinculada a métrica, notas post-scrim
- [ ] **Draft Board** — hero pool por jugador, comfort picks, bans recomendados, comps guardadas
- [ ] **Playbook** — biblioteca de estrategias, setups y reglas tácticas del equipo
- [ ] **Review Sessions** — sesiones de review organizadas con agenda, review items, boards y action items

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

---

## Referencias
- `docs/PrimeSight_Especificacion_Producto_Analitica_v3.pdf`
- `docs/PrimeSight_Team_Tools_Analysis_Tools_Discord_Bot.md`
- `docs/workflow.md`
- `docs/project_predecessor.md`
- `docs/predecessor_api_technical_doc.md`
- `docs/predgg_api_inventory.md`
- `docs/primesight_indicators_catalog.csv`
- `docs/primesight_visual_design_direction.md`
