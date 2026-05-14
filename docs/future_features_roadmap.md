# Roadmap de features futuras — RiftLine

Backlog priorizado de funcionalidades pendientes para la plataforma RiftLine (Competitive Intel para Predecessor).

Complementa:
- `docs/planning.md` → tareas activas con desglose operativo
- `docs/react_crash_patterns.md` → diagnóstico de crashes React
- GitHub Issues → unidad de trabajo accionable

> **Principio rector:** reglas deterministas primero. LLM solo para resumir evidencias ya calculadas. Nunca inventar causalidad ni predicciones no trazables.

---

## Escala de prioridad

| Nivel | Criterio |
|-------|----------|
| **P0 — Crítico** | Bloquea estabilidad, datos o el flujo principal en producción |
| **P1 — Alto valor** | Mejora fuerte y directa para coaches/staff/jugadores |
| **P2 — Medio plazo** | Útil, no bloquea el core. Construir cuando P1 esté validado |
| **P3 — Largo plazo** | Experimental o dependiente de datos/uso real todavía insuficiente |

---

## Estado a Mayo 2026

### Completado ✅
| Feature | Tarea |
|---------|-------|
| Player Scouting, Team Analysis, Match Detail (Timeline, Analysis, Stats) | T3, T6 |
| Analyst Rules Engine (9 reglas deterministas) | T8 |
| Review Queue + Team/Player Goals | T10 |
| Battle Plan prescriptivo (ScrimReport mejorado) | T12 |
| Zonas tácticas del mapa (11 zonas calibradas) | T13 |
| VOD & Replay Index | T16 |
| RBAC completo + invitaciones + perfiles de usuario | T17 |
| View As Role (admin previsualiza como cualquier rol) | T17 |
| Player self-linking (vinculación de perfil de jugador) | T17 |
| Backend Analytics: Phase/Vision/Objective/Draft Analysis | T20 |
| Rival Scouting (`/analysis/rival`) | T20 |
| Platform Admin panel (Staff, Data Controls, Audit Logs) | T20 |
| Rebrand RiftLine + Landing page + Login fullscreen | T21 |
| Dashboard diferenciado por rol | T21 |
| Sistema de retención de datos (3 meses configurable + cron mensual) | T22 |
| Despliegue en Railway (single service: API + frontend) | T22 |

### En producción / desplegando 🚀
- Railway deployment — PR #152

---

# P0 — Crítico

## 1. Estabilización del despliegue en Railway

**Estado:** En curso  
**Plazo estimado:** inmediato

- [ ] Verificar health check en producción (`/health`)
- [ ] Confirmar que cookies httpOnly funcionan con HTTPS en Railway
- [ ] Actualizar `PRED_GG_CALLBACK_URL` y `FRONTEND_URL` con el dominio de Railway
- [ ] Verificar que el sync worker funciona desde el admin panel en producción
- [ ] Confirmar que el cron de limpieza mensual arranca correctamente
- [ ] Dominio personalizado (opcional, post-estabilización)

---

## 2. Migración a TimescaleDB

**Estado:** Planificado  
**Plazo estimado:** tras estabilizar producción  
**Impacto:** reducción 5-10x en espacio de event stream. `drop_chunks()` en lugar de `DELETE` masivo.

- [ ] Añadir TimescaleDB como servicio en Railway (template disponible)
- [ ] Convertir tablas de event stream a hypertables por `startTime`/`gameTime`:
  - `HeroKill`, `ObjectiveKill`, `WardEvent`, `Transaction`, `StructureDestruction`
- [ ] Activar política de compresión columnar automática para chunks > 1 mes
- [ ] Migrar `cleanupOldData()` a `drop_chunks(INTERVAL '3 months')`
- [ ] Validar compatibilidad con Prisma (transparente — sigue siendo PostgreSQL)
- [ ] Objetivo de espacio: de ~3 GB → ~400 MB con retención de 3 meses

**Referencia técnica:** TimescaleDB comprime datos de series temporales en bloques columnares. Queries por rango temporal son 10-100x más rápidas porque el planificador salta directamente al chunk correcto en lugar de escanear toda la tabla.

---

# P1 — Alto valor

## 3. Analyst: LLM AI Summaries (Claude API)

**Estado:** Planificado  
**Prerequisito:** T8 validada en producción  
**Coste estimado:** <$0.01 por análisis (claude-sonnet-4-6 con prompt caching)

- [ ] "Focus of the Day" en Dashboard — resumen diario de 3-5 insights clave del equipo
- [ ] Streaming SSE al frontend (respuesta progresiva)
- [ ] Prompt caching del contexto fijo de Predecessor (reglas del juego, mecánicas)
- [ ] El LLM **resume** evidencias ya calculadas, no inventa causalidad
- [ ] Opción "Explicar este insight" en InsightCard — LLM explica el porqué en lenguaje natural

**Límites claros:**
- Nunca generar recomendaciones sin evidencia trazable de la DB
- No predecir resultados de partidas
- Todo lo que muestre el LLM debe poder respaldarse con datos reales

---

## 4. Coach Session Mode

**Estado:** Planificado  
**Uso:** proyectar en Discord/stream durante sesiones de review

- [ ] Vista limpia activable desde header (MANAGER/COACH)
- [ ] Muestra: Battle Plan + 3 insights clave + objetivos de sesión activos
- [ ] Sin sidebar ni distracciones de navegación
- [ ] Fullscreen con font grande legible desde lejos

---

## 5. B2C Player: Weekly Performance Summary

**Estado:** Planificado  
**Rol:** PLAYER standalone (sin equipo)

- [ ] `GET /reports/player-weekly/:playerId` — KDA semanal vs histórico, héroe más jugado, WR 7d vs 30d, mejora/bajada de métricas clave, partidas jugadas en la semana
- [ ] Página `/reports/weekly` con condicional por rol
- [ ] Trend up/down por métrica con comparativa semana anterior
- [ ] Player Development autogenerado desde reglas (slump, hero pool, consistencia)

---

## 6. Tactical Board

**Estado:** Planificado  
**Librería recomendada:** Konva.js (canvas con React)

- [ ] Modelos `TacticalBoard` + `BoardObject` en schema.prisma
- [ ] Crear tablero vacío sobre el mapa de Predecessor
- [ ] Tipos de objeto: `ally_player`, `enemy_player`, `ward`, `danger_zone`, `engage_point`, `rotation_arrow`, `objective_setup`, `reset_point`, `do_not_fight`, `priority_area`, `text_note`
- [ ] Guardar/cargar tablero, asociar a match/equipo/rival
- [ ] Duplicar tablero para variantes
- [ ] Exportar como imagen
- [ ] Coordenadas normalizadas (MAP_BOUNDS ya calibrados)

**Casos de uso prioritarios:** Fangtooth setup · Shaper setup · Prime defense · Corrección de error con anotación

---

## 7. Discord Companion Bot (MVP)

**Estado:** Planificado  
**Prerequisito:** T8 + T10 en producción y validadas  
**Arquitectura:** bot consume datos procesados por RiftLine — no calcula nada propio

- [ ] Modelos `DiscordIntegration`, `DiscordChannelConfig`, `NotificationRule` en schema.prisma
- [ ] Vincular servidor Discord ↔ equipo de RiftLine
- [ ] Configurar canales: alerts, match-reports, review-queue, team-goals, scouting
- [ ] Enviar resumen de partida al importar (resultado, duración, alertas críticas, botones a RiftLine)
- [ ] Enviar Review Alert cuando `severity: critical`
- [ ] Slash commands: `/riftline match <id>`, `/riftline review pending`, `/riftline report last-match`
- [ ] Permisos mínimos: Send Messages, Embed Links, Use Slash Commands — **sin Administrator**

**Canales recomendados:** `#riftline-alerts` · `#match-reports` · `#review-queue` · `#team-goals` · `#scouting-reports`

---

# P2 — Medio plazo

## 8. Tactical Timeline con anotaciones

**Estado:** Planificado  
**Diferencia con el Timeline tab actual:** orientado a sesión de review de equipo, con anotaciones y creación de review items

- [ ] Cargar partida por Match ID
- [ ] Eventos sobre mapa con slider temporal
- [ ] Event Feed lateral: gameTime, eventType, player, hero, context, priority
- [ ] Filtros: equipo, evento, rol, jugador, fase, objetivo cercano, ventana (30/60/90/120s)
- [ ] Crear Review Item desde evento
- [ ] Añadir anotación de coach a evento
- [ ] Guardar sesión asociada a match

**Limitaciones a comunicar en UI:** no hay posición continua de jugadores, no infiere rutas, no sustituye el replay del juego.

---

## 9. Scrim Planner + Playbook + Review Sessions

**Estado:** Futuro  
**Prerequisito:** Review Queue + Tactical Board validados en uso real

- [ ] **Scrim Planner** — planificador de scrims con focus area vinculada a métrica, notas post-scrim
- [ ] **Playbook** — biblioteca de estrategias, setups y reglas tácticas del equipo
- [ ] **Review Sessions** — sesiones organizadas con agenda, review items, boards y action items

---

## 10. Rival alerting system

**Estado:** Planificado

Alertas automáticas cuando un rival trackado cambia:
- [ ] Hero pool — nuevo héroe en rotación o abandona rotación
- [ ] Role swap — cambio de rol de un jugador clave
- [ ] Performance drop/spike — cambio significativo de KDA/WR
- [ ] Nuevo jugador en roster
- [ ] Cambio de tendencia de bans/picks

Canales: in-app (badge en `/analysis/rival`) + Discord (cuando el bot esté activo)

---

## 11. Mobile responsive: mejoras pendientes

**Estado:** Planificado  
**Prioridad en vistas:** Player Search → Profile · Dashboard PLAYER · Scrim Report (lectura)

- [ ] Breakpoints 640px/1024px en App.css (actualmente solo 920px para sidebar)
- [ ] Sidebar colapsable en tablet
- [ ] Tablas con scroll horizontal en mobile
- [ ] Match Detail — adaptar swim lanes del Timeline para pantalla pequeña

---

## 12. Draft Board interactivo

**Estado:** Planificado  
**Nota:** Draft Analysis (estadísticas de picks/bans) ya está implementado. Esto es la herramienta de planificación activa.

- [ ] Hero pool por jugador con comfort score
- [ ] Recomendaciones de bans basadas en rival scouting
- [ ] Guardar composiciones y draft plans
- [ ] Patch-aware filtering
- [ ] **No incluye en MVP:** live draft automation, inferir orden real de picks/bans cuando la API no lo expone

---

# P3 — Largo plazo / experimental

## 13. Matchup evaluator explicable

**Prerequisito:** datos suficientes de hero pool y Build/Stat Calculator  
**Regla:** produce ventaja/riesgo, no "ganador garantizado"

Dimensiones a evaluar:
- burst window por nivel/item spike
- sustained DPS, durability, mobility, crowd control pressure
- weak/strong phases

---

## 14. Build/Stat Calculator

**Estado:** Pospuesto  
**Motivo:** alto mantenimiento por parche. Validar primero demanda real de usuarios.

- Selección: versión, héroe, nivel, rol, crest/items, skill order
- Salida: base stats + bonus + final + ability values
- **Regla crítica:** no fingir pasivas no soportadas por la API. Etiquetar como unsupported/partial.

---

## 15. Opponent strategy fingerprinting

Clasificar estilo de rival de forma automática:
- early pressure · objective control · scaling · dive/pick · vision denial · weak-side

Basado en features del event stream. Validación manual del coach antes de mostrar etiqueta.

---

## 16. Live Draft Mode / overlays

**Estado:** Experimental — alto riesgo  
**Antes de implementar:**
- revisar compliance con el juego y torneos
- validar utilidad real con usuarios
- evitar overlays que puedan considerarse ventaja indebida en competición oficial

---

## 17. Discord OAuth (login social)

**Estado:** Pospuesto  
**Motivo:** login interno en producción funciona bien. OAuth añade complejidad sin urgencia.  
**Cuando implementar:** cuando el volumen de usuarios justifique el coste de mantenimiento.

---

# Funcionalidades explícitamente fuera de scope

| Funcionalidad | Motivo |
|---------------|-------|
| Predicción exacta de ganador | No fiable ni explicable con datos disponibles |
| Pathing continuo de jugadores | La API expone eventos puntuales, no trayectoria |
| POV automático desde replay | No hay soporte oficial — usar VOD Index |
| IA generativa como motor principal | Reglas primero; LLM solo resume evidencias |
| Simulación completa de teamfight | Complejidad muy alta, no necesaria para MVP |
| Migración automática de builds entre parches | Puede romper semántica si cambian items/stats |
| Predicción de roster de rival | Insuficientes datos y riesgo de falsos positivos |

---

# Orden recomendado de implementación

```
1. Estabilizar Railway (P0) ← AHORA
2. TimescaleDB (P0) ← después de estabilizar
3. LLM AI Summaries (P1) ← alto ROI con bajo esfuerzo
4. Coach Session Mode (P1) ← rápido de implementar
5. B2C Player Weekly Reports (P1) ← nuevo segmento de usuarios
6. Tactical Board (P1) ← alta demanda de coaches
7. Discord Bot MVP (P1) ← multiplica el alcance de la plataforma
8. Tactical Timeline (P2)
9. Rival alerting (P2)
10. Mobile responsive (P2)
11. Scrim Planner + Playbook (P2)
12. Draft Board interactivo (P2)
13. Matchup evaluator (P3)
14. Build/Stat Calculator (P3)
15. Opponent fingerprinting (P3)
```

---

## Nota de mantenimiento

Cuando una feature pase a desarrollo activo → moverla a `docs/planning.md` con desglose de subtareas.  
Este documento es el backlog estratégico, no el tablero operativo.  
Revisar prioridades cada 2-3 meses o tras validación con usuarios reales.
