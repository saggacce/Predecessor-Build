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

### 6B — Match Statistics tab (pendiente — datos verificados disponibles en pred.gg)
### 6C — Event stream sync (pendiente)
### 6D — Timeline tab (pendiente)
### 6E — Analysis tab + métricas Fase 2 (pendiente)

- [ ] Extender sync worker para capturar event stream completo por partida:
  - [ ] `heroKills` {gameTime, location x/y/z, killerTeam, killedTeam, killerHero, killedHero}
  - [ ] `objectiveKills` {gameTime, killedEntityType, killerTeam, killerPlayer, location}
  - [ ] `structureDestructions` {gameTime, structureEntityType, destructionTeam, location}
  - [ ] `wardPlacements` / `wardDestructions` {gameTime, type, location} por jugador
  - [ ] `goldEarnedAtInterval` (array acumulado por minuto) por jugador
  - [ ] `transactions` {gameTime, transactionType, itemData} para item timing (IND-034)
  - [ ] `heroBans` {hero, team} solo en partidas RANKED
- [ ] Definir zonas tácticas del mapa (polígonos): entrada Fangtooth, zona Prime, carriles, jungla rival.
- [ ] Métricas de Fase 2: Deaths Before Objective (IND-018), Death Zone Frequency (IND-020), Objective Control (TEAM-008 a TEAM-013), Gold Diff (TEAM-005/006/007).
- [ ] Heatmap panel: muertes, objetivos, wards sobre imagen del mapa (`assets/maps/map.png`).

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
