# Planning del proyecto

Tablero simple de tareas generales y subtareas.

## Estado
- [ ] Pendiente
- [x] Completada

## Cómo usar este documento

1. Cada tarea general debe tener subtareas concretas.
2. Marcar subtareas como `[x]` según se completan.
3. Cuando todas las subtareas estén completadas, marcar la tarea general como `[x]`.
4. Si una tarea cambia de alcance, actualizar descripción y subtareas en el mismo commit.

---

## [x] Tarea 1 — Fundaciones de datos (Scouting)
- [x] Definir esquema normalizado mínimo (jugador, equipo, partida, parche). → `workers/data-sync/prisma/schema.prisma`
- [x] Diseñar proceso de sincronización inicial desde fuentes externas. → `workers/data-sync/src/sync/`
- [x] Establecer estrategia de versionado por parche/sync timestamp. → `Version` model + `syncedAt` en todos los registros
- [x] Documentar política de calidad/frescura de datos. → `docs/data_quality_policy.md`

## [x] Tarea 2 — API de scouting (MVP)
- [x] Endpoint de perfil de jugador. → `GET /players/:id`
- [x] Endpoint de perfil de equipo. → `GET /teams/:id`
- [x] Endpoint de comparación de jugadores. → `POST /players/compare`
- [x] Endpoint de generación de reportes de scrim. → `POST /reports/scrim`

## Tarea 3 — Frontend de análisis competitivo (MVP)
- [x] Login con pred.gg (OAuth2 PKCE + sesión persistente 30 días). → `apps/api/src/routes/auth.ts` + sidebar
- [x] Vista de scouting de jugador rival. → `apps/web/src/pages/PlayerScouting.tsx` (máquina de estados 10 fases, ficha completa, filtro por modo de partida)
- [x] Vista básica de análisis de equipo. → `apps/web/src/pages/TeamAnalysis.tsx` (stub con roster y stats agregadas)
- [x] Vista básica de reporte pre-scrim. → `apps/web/src/pages/ScrimReport.tsx` (generación básica con notas de matchup)
- [x] Gestión de equipos (crear, editar, añadir jugadores al roster). → `apps/api/src/routes/teams.ts` + `apps/web/src/pages/TeamAnalysis.tsx`
- [ ] Vista de seguimiento de jugadores propios (histórico, evolución).
- [ ] Análisis de equipo rival enriquecido (objetivos, timeline, draft tendencies).
- [ ] Descarga/exportación de reporte pre-scrim.

## Tarea 4 — Calidad y operación
- [x] Convenciones de logs/errores para sync y API. → Pino con redacción de credenciales, logging estructurado JSON
- [x] Tests base de rutas API (players, teams, admin). → 43 tests en Vitest + Supertest
- [x] CI/CD con GitHub Actions. → `.github/workflows/ci.yml` (typecheck + vitest en cada PR)
- [x] Branch protection en main. → CI requerido antes de merge
- [ ] Tests de agregación de métricas de jugador.
- [ ] Tests de filtros por parche/ventana temporal.
- [ ] Checklist de release interno por fase.

## [x] Tarea 5 — Mejoras de gestión de equipos y jugadores
- [x] Subida de logo de equipo (upload de imagen o URL) en formulario de crear/editar equipo. → `apps/web/src/pages/TeamAnalysis.tsx` (FileReader → base64 data URL → logoUrl)
- [x] Nombre personalizado para jugadores sin cuenta pred.gg (`customName`):
  - [x] Migration: añadir campo `customName String?` a modelo `Player` en Prisma.
  - [x] API: `PATCH /players/:id/name` → actualiza `customName`, nunca sobreescrito por sync.
  - [x] Lógica de display: `customName ?? displayName` en toda la app (TeamAnalysis, PlayerScouting, report-service).
  - [x] UI: icono de edición (Pencil) junto al nombre en roster — inline edit con Enter/Escape, badge "custom" si hay nombre personalizado.
  - [ ] Sync worker: al procesar event stream, crear registro `Player` para todos los UUIDs encontrados aunque no tengan nombre (prerequisito: Fase 2 event stream activo).

## Tarea 6 — Event stream, match detail y métricas de Fase 2
*Ver `docs/primesight_indicators_catalog.csv` para detalle de indicadores y fases.*

### [x] 6A — Match detail: Scoreboard + mejoras UI extensas (PR #40)
- [x] `GET /matches/:id` + `POST /matches/:id/sync` + `GET /hero-meta` endpoints
- [x] Hero/item/icon/rank assets como static desde API, proxy Vite extendido
- [x] Página `/matches/:id` con Scoreboard: barras de daño, KP%, GPM, wards P/D, level
- [x] Team score banner, column tooltips (HeaderTooltip), role como columna separada
- [x] HeroAvatarWithTooltip (portal) con clase y roles del héroe desde pred.gg
- [x] Iconos de rol reales (/icons/roles/*.png), hero names normalizados
- [x] Navegación bidireccional PlayerScouting ↔ Match detail (location.state)
- [x] Click en jugador del Scoreboard → su perfil
- [x] isConsole + wardsDestroyed + level: migrations Prisma + re-sync
- [x] Recent Matches rediseñada: headers, badges coloreados, columnas fr
- [x] Role Performance cards: icono grande centrado + 4 métricas
- [x] Iconos de rango locales (assets/ranks/) + RankIcon component
- [x] Perfil jugador: icono rango circular pred.gg-style, bandera región, season badges
- [x] GET /players/:id/seasons → historial de ratings por temporada

### [x] 6B — Match Statistics tab
- [x] 16 campos nuevos en MatchPlayer (daño físico/mágico/verdadero, daño recibido, curación, CS, goldSpent, crits, sprees, multi-kills)
- [x] `MATCH_DETAIL_QUERY` extendida para fetchear los nuevos campos
- [x] Tab "Statistics" habilitado con 3 secciones: Damage Output (barra tricolor P/M/T), Survivability, Farm & Highlights
- [x] Empty state con botón "Sync match stats" cuando no hay datos extendidos

### [x] 6C — Event stream sync
- [x] 6 tablas nuevas: HeroKill, ObjectiveKill, StructureDestruction, WardEvent, Transaction, HeroBan
- [x] Match.eventStreamSynced + MatchPlayer.goldEarnedAtInterval
- [x] `syncMatchEventStream` — persiste todos los eventos; se dispara desde resyncMatch cuando hay Bearer
- [x] Auto-sync silencioso al cargar un match con eventStreamSynced=false
- [x] Botón "Sync match data" visible cuando !eventStreamSynced (no solo con jugadores HIDDEN)
### [x] 6D — Timeline tab
- [x] GET /matches/:id/events — devuelve HeroKills, ObjectiveKills, StructureDestructions, WardEvents, Transactions
- [x] Timeline horizontal scrollable con swim lanes separadas: Kills (DUSK/DAWN), Objectives, Structures, Purchases, Wards
- [x] Zoom ×0.5 a ×8 con botones +/−
- [x] Tooltips con portal (no se cortan) — kill: víctima🔪 + asesino⚔️ con héroe; objetivo: equipo + héroe que lo mató
- [x] Minimapa interactivo: hover→punto en mapa, click→pin, calibración exacta por regresión sobre 10 puntos reales
- [x] MAP_BOUNDS calibrados: {minX:-16311, maxX:17637, minY:-16498, maxY:20026}
- [x] Deduplicación MatchPlayer + índices únicos (matchId,playerId) y (matchId,predggPlayerUuid)
- [x] rosterSynced / eventStreamSynced flags con guards anti-duplicado en resyncMatch
### [x] 6E — Analysis tab + métricas Fase 2
- [x] Objective Control cards (TEAM-008/009/010/011/012) — Fangtooth, Prime, Shaper, Buffs, River con barra DUSK/DAWN, total y primer objetivo
- [x] Gold Diff timeline SVG (TEAM-005/006/007) — área teal/roja, marcadores de objetivos con tooltip interactivo, throw/comeback detection
- [x] Deaths Before Objectives table (IND-018/TEAM-013) — ventanas −30/60/120s antes de Fangtooth/Prime/Shaper
- [x] Match Heatmap con capas: kills (muerto por equipo), wards (placed/destroyed), objectives (por tipo)
- [x] goldEarnedAtInterval en MatchPlayerDetail + regeneración Prisma client del workspace
- [x] Re-sync manual fuerza ambos flags (forceRoster + force event stream)
- [ ] Death Zone Frequency (IND-020) — requiere definición manual de polígonos de zonas tácticas

## Tarea 7 — Build/Stat module (fase posterior)
- [ ] Definir contrato de inputs/outputs del motor.
- [ ] Implementar cálculo base por nivel + ítems + skills.
- [ ] Añadir comparación entre builds del mismo héroe.
- [ ] Integrar visualización de deltas y spikes.

---

## Referencias
- `docs/workflow.md`
- `docs/project_predecessor.md`
- `docs/predecessor_api_technical_doc.md`
- `docs/predgg_api_inventory.md`
- `docs/future_features_roadmap.md`
- `docs/primesight_indicators_catalog.csv` — catálogo completo de indicadores con fases, dependencias y viabilidad
- `docs/primesight_visual_design_direction.md` — dirección visual, componentes, limitaciones de datos confirmadas
