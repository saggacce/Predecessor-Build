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

## Tarea 1 — Fundaciones de datos (Scouting)
- [x] Definir esquema normalizado mínimo (jugador, equipo, partida, parche). → `workers/data-sync/prisma/schema.prisma`
- [x] Diseñar proceso de sincronización inicial desde fuentes externas. → `workers/data-sync/src/sync/` (versions, players, matches)
- [x] Establecer estrategia de versionado por parche/sync timestamp. → Version model + syncedAt en todos los registros
- [x] Documentar política de calidad/frescura de datos. → `docs/data_quality_policy.md`

## Tarea 2 — API de scouting (MVP)
- [x] Endpoint de perfil de jugador.
- [x] Endpoint de perfil de equipo.
- [x] Endpoint de comparación de jugadores.
- [x] Endpoint de generación de reportes de scrim.

## Tarea 3 — Frontend de análisis competitivo (MVP)
- [x] Vista de scouting de jugador rival. → `apps/web/src/pages/PlayerScouting.tsx` (máquina de estados 10 fases, ficha completa con stats, héroes, partidas recientes)
- [x] Login con pred.gg (OAuth2 PKCE). → `apps/api/src/routes/auth.ts` + botón en sidebar
- [ ] Vista de seguimiento de jugadores propios.
- [ ] Vista de análisis de equipo rival.
- [ ] Vista/descarga de reporte pre-scrim.

## Tarea 4 — Calidad y operación
- [x] Convenciones de logs/errores para sync y API. → Pino con redacción de credenciales, logging estructurado
- [ ] Tests base de agregación de métricas.
- [ ] Tests base de filtros por parche/ventana temporal.
- [ ] Checklist de release interno por fase.

## Tarea 5 — Build/Stat module (fase posterior)
- [ ] Definir contrato de inputs/outputs del motor.
- [ ] Implementar cálculo base por nivel + ítems + skills.
- [ ] Añadir comparación entre builds del mismo héroe.
- [ ] Integrar visualización de deltas y spikes.

---

## Referencias
- `docs/workflow.md`
- `docs/project_predecessor.md`
- `docs/predecessor_api_technical_doc.md`
- `docs/future_features_roadmap.md`
