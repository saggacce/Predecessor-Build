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
- [x] 52 tests en Vitest + Supertest
- [x] CI/CD GitHub Actions + branch protection en main
- [ ] Tests de agregación de métricas de jugador
- [ ] Tests de filtros por parche/ventana temporal

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

## Tarea 8 — Analyst: Rules Engine
Motor determinista. Genera insights estructurados con evidencia trazable. Sin LLM, sin coste de inferencia.

### Arquitectura
- `GET /analysis/insights/:teamId` → lista ordenada por severidad
- Cada insight: `{ id, severity, category, title, evidence[], recommendation, reviewRequired }`
- Severidades: `critical | high | medium | low | positive`
- Panel "Analyst" en TeamAnalysis y PlayerScouting

### Reglas iniciales (datos disponibles ahora)
- [ ] Muerte crítica pre-objetivo — jungla/carry/support muere 60s antes de Fangtooth/Prime/Shaper en ≥60% de partidas → *"Revisar setup antes de objetivo"*
- [ ] Baja visión previa — 0 wards cerca del objetivo 90s antes en ≥50% de partidas → *"Objetivo disputado sin visión"*
- [ ] Visión limpiada — ≥2 wards destruidas 120s antes de objetivo → *"El rival limpió el área"*
- [ ] Prime no convertido — Orb Prime tomado + 0 estructuras en 180s en ≥50% de tomas → *"Ventaja no convertida"*
- [ ] Draft dependency — top 2 héroes de un jugador >60% de sus picks → *"Vulnerabilidad a bans"*
- [ ] Throw pattern — ventaja gold >3k convertida en derrota en ≥2 partidas → *"Patrón de throw"*
- [ ] Player slump — KDA <1.5 en últimas 10 vs histórico → *"Bajón de rendimiento"*
- [ ] Vision gaps — wards/min del equipo por debajo de la media del rol → *"Visión insuficiente"*
- [ ] Reinforcement positivo — Fangtooth control >70%, Prime conversion >60% → destacar como fortaleza

### Pendiente
- [ ] Umbrales configurables por coach (no hardcodeados)
- [ ] Panel UI: tarjetas de insight con severity badge + evidencia colapsable
- [ ] Flag `reviewRequired: true` para enlazar con Tarea 10 (Review Queue)

---

## Tarea 9 — Analyst: LLM (Claude API)
*Prerequisito: Tarea 8 completa y validada.*

- [ ] Prompt caching para contexto del juego (system prompt fijo con reglas de Predecessor)
- [ ] Streaming SSE al frontend → "Focus of the Day" en Dashboard
- [ ] AI Summary: LLM resume insights ya calculados, no inventa causalidad
- [ ] Coste estimado: <$0.01 por análisis con claude-sonnet-4-6

---

## Tarea 10 — Team Tools: Review Queue y flujo de entrenamiento
El módulo de mayor ROI no implementado. Convierte detección de patrones en trabajo real de revisión.
*Prerequisito: Tarea 8 activa.*

### Modelo de datos
- [ ] Tabla `ReviewItem`: `{ id, matchId, teamId, playerId, eventId, gameTime, priority, reason, status, coachComment, assignedTo, actionItem, vodUrl, vodTimestamp }`
- [ ] Tabla `TeamGoal`: `{ id, teamId, title, metricId, baselineValue, targetValue, currentValue, timeframe, priority, status }`
- [ ] Tabla `PlayerGoal`: `{ id, playerId, teamId, title, metricId, baseline, target, coachNote, visibility, status }`

### Flujo
```
Rules Engine detecta evento → ReviewItem (status: pending)
→ Coach revisa en cola ordenada por severidad
→ Coach confirma / descarta / marca dudoso
→ Coach asigna tag de causa + acción correctiva
→ Sistema mide si el patrón mejora en partidas siguientes
```

### Estados de ReviewItem
`pending` · `in_review` · `reviewed` · `false_positive` · `team_issue` · `player_issue` · `draft_issue` · `added_to_training`

### Tags manuales
`bad_objective_setup` · `facecheck` · `bad_reset` · `late_rotation` · `bad_engage` · `ignored_call` · `bad_secure` · `poor_conversion`

### API
- [ ] `POST /review-items` — crear desde insight
- [ ] `PATCH /review-items/:id` — confirmar/descartar + tag + nota
- [ ] `GET /review-items` — cola paginada, filtrable por severidad/status/team
- [ ] `POST /goals/team` + `GET /goals/team/:teamId`
- [ ] `POST /goals/player` + `GET /goals/player/:playerId`

### UI
- [ ] Página Review Queue: tarjetas con timestamp, minimap snippet, descripción, botones de acción
- [ ] Team Goals panel en TeamAnalysis: métricas vinculadas, estado, progreso
- [ ] Player Goals: privado por defecto, visible solo para el jugador afectado y staff

---

## Tarea 11 — UI/UX V2: mejoras de calidad
Mejoras basadas en el Documento Maestro V2 y el audit visual.

### Quick wins (datos ya disponibles, cambios pequeños)
- [ ] Colores OWN (cian) / RIVAL (rojo) en lista de equipos, badges y bordes
- [ ] Hover iluminado en filas de Team Analysis
- [ ] Separar icono Delete del icono Edit (8px+ de margen)
- [ ] "Last 20" en verde si WR reciente > histórico, rojo si menor
- [ ] Barras de progreso detrás de GPM/DPM en Player Comparison (comparación visual sin leer números)
- [ ] Pocket Pick Highlight — borde dorado en héroes con <10 partidas pero >65% WR
- [ ] Status Badges en equipos: "Incomplete Roster" (<5 jugadores), "Performance Drop"
- [ ] Quick Report button en cada fila de Team Analysis
- [ ] Sticky header en tabla Player Comparison
- [ ] One-Trick Alert: icono target sobre héroe del rival que es one-trick en ScrimReport

### Dashboard
- [ ] Compactar buscador y bloque de bienvenida
- [ ] "Pulse Server" — punto LED verde/naranja en lugar del botón Syncing
- [ ] Sustituir métricas de vanidad por Objective Success %, Vision Consistency

### Battle Plan (ScrimReport mejorado)
- [ ] Visual VS con logos de ambos equipos
- [ ] Intelligence Notes divididas por categoría: ⚠️ alertas / 💡 oportunidades / 🎯 banos
- [ ] Sección "Win Conditions" — 3 puntos prescriptivos generados por reglas
- [ ] Modo Full Screen para proyectar en sesiones de vídeo

### Coach Session mode
- [ ] Vista limpia para proyectar en Discord/stream interno: Battle Plan + 3 insights clave + objetivos de sesión

---

## Tarea 12 — Pre-Match Intelligence: Battle Plan prescriptivo
*Alineado con fase V2 del roadmap del spec. Prerequisito: Tarea 8 (reglas).*

- [ ] Selector con estética "VS" — logos de ambos equipos enfrentados
- [ ] Filtro de timeframe (últimas N partidas / parche actual)
- [ ] **Win Condition** — prescriptivo desde reglas: "Su equipo cae en late → forzar early"
- [ ] **Target Players** — amenazas por rol con evidencia (WR, DPM, early death rate)
- [ ] **Objective Plan** — control rival por objetivo + ventana temporal media
- [ ] **Avoid List** — zonas de mapa con ratio K/D desfavorable (si hay event stream)
- [ ] **Roster Validator** — aviso si el rival ha jugado con suplentes recientes (`TeamRoster.activeFrom`)

---

## Tarea 13 — Zonas tácticas del mapa (prerequisito bloqueante)
Sin polígonos definidos, ~15 indicadores del catálogo no son calculables.

- [ ] Definir polígonos manualmente sobre el mapa calibrado (MAP_BOUNDS ya conocidos)
- [ ] Zonas mínimas: `FANGTOOTH_PIT`, `FANGTOOTH_ENTRANCES`, `MINI_PRIME_PIT`, `ORB_PRIME_PIT`, `SHAPER_PIT`, `MID_LANE`, `DUO_LANE`, `OFFLANE`, `OWN_JUNGLE`, `ENEMY_JUNGLE`, `RIVER_BUFF_AREAS`
- [ ] Tabla `MapZone`: `{ id, name, polygon (JSON), zoneType, relatedObjective }`
- [ ] Función `pointInZone(x, y, zone)` en domain-engine

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

## Tarea 16 — Team Tools: VOD & Replay Index
Índice de enlaces externos. No reproducir vídeo dentro de PrimeSight.

### Modelo de datos
- [ ] Tabla `VodLink`: `{ id, matchId, playerId?, teamId, type, url, gameTimeStart?, gameTimeEnd?, videoTimestampStart?, videoTimestampEnd?, tags, notes, visibility }`

### Tipos
`full_match` · `player_pov` · `clip` · `coach_review` · `scrim_recording` · `tournament_vod` · `ingame_replay_ref`

### UI
- [ ] Lista de VODs por partida en Match Detail
- [ ] Añadir/editar/borrar VOD link con timestamp
- [ ] Filtrar por tipo y jugador
- [ ] Botón "Open at timestamp" (abre YouTube/Twitch en el momento)

---

## Tarea 17 — Auth: RBAC, invitaciones y perfiles de usuario
*Prerequisito para multi-usuario. Para la fase de testing actual: User + Invitation + roles básicos.*

### Fase 1 — Para el testing (ahora)
- [ ] Tabla `User`: `{ id, email, name, passwordHash?, predggPlayerId?, discordId?, globalRole, tier, createdAt }`
- [ ] Tabla `Invitation`: `{ id, email, token, globalRole, teamId?, expiresAt, usedAt, createdBy }`
- [ ] Tabla `TeamMembership`: `{ userId, teamId, role }`
- [ ] Endpoint `POST /invitations` — crear token + enviar email (Resend/SendGrid)
- [ ] Endpoint `GET /invitations/:token` — validar token
- [ ] Endpoint `POST /auth/register` — crear cuenta desde invitation token
- [ ] Middleware de autorización por rol en rutas sensibles

### Roles globales (MVP)
`admin` · `staff` · `viewer`

### Roles por equipo (MVP)
`owner` · `coach` · `analyst` · `player`

### Fase 2 — Cuando haya usuarios externos
- [ ] Discord OAuth como segundo proveedor de login
- [ ] Tabla `PlayerAlias`: `{ mainPlayerId, aliasPlayerId, label }` — vincular múltiples cuentas
- [ ] Tabla `PlayerNameHistory`: `{ playerId, name, seenAt }` — historial de nombres por UUID
- [ ] UI de gestión de perfil para jugadores autenticados

### Tiers de monetización (campo en User, gates de feature después)
`free` · `team` · `enterprise` — añadir el campo ahora, implementar gates cuando haya clientes reales

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
