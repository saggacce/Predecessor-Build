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

## Tarea 5 — Mejoras de gestión de equipos y jugadores
- [ ] Subida de logo de equipo (upload de imagen o URL) en formulario de crear/editar equipo. → `apps/api/src/routes/teams.ts` + `apps/web/src/pages/TeamAnalysis.tsx`
- [ ] Nombre personalizado para jugadores sin cuenta pred.gg (`customName`):
  - [ ] Migration: añadir campo `customName String?` a modelo `Player` en Prisma.
  - [ ] API: `PATCH /players/:id/name` → actualiza `customName`, nunca sobreescrito por sync.
  - [ ] Lógica de display: `customName ?? displayName ?? "Unknown"` en toda la app.
  - [ ] UI: icono de edición junto al nombre en roster y vistas de scouting para jugadores sin nombre pred.gg.
  - [ ] Sync worker: al procesar event stream, crear registro `Player` para todos los UUIDs encontrados aunque no tengan nombre (prerequisito: Fase 2 event stream activo).

## Tarea 6 — Event stream y métricas de Fase 2
*Prerequisito: completar Tarea 5 primero. Ver `docs/primesight_indicators_catalog.csv` para detalle de indicadores y fases.*
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
