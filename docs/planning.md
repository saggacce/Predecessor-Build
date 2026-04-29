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
- [ ] Definir esquema normalizado mínimo (jugador, equipo, partida, parche).
- [ ] Diseñar proceso de sincronización inicial desde fuentes externas.
- [ ] Establecer estrategia de versionado por parche/sync timestamp.
- [ ] Documentar política de calidad/frescura de datos.

## Tarea 2 — API de scouting (MVP)
- [ ] Endpoint de perfil de jugador.
- [ ] Endpoint de perfil de equipo.
- [ ] Endpoint de comparación de jugadores.
- [ ] Endpoint de generación de reportes de scrim.

## Tarea 3 — Frontend de análisis competitivo (MVP)
- [ ] Vista de seguimiento de jugadores propios.
- [ ] Vista de scouting de jugador rival.
- [ ] Vista de análisis de equipo rival.
- [ ] Vista/descarga de reporte pre-scrim.

## Tarea 4 — Calidad y operación
- [ ] Tests base de agregación de métricas.
- [ ] Tests base de filtros por parche/ventana temporal.
- [ ] Convenciones de logs/errores para sync y API.
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
