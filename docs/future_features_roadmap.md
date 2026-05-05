# Future Features Roadmap — PrimeSight

Backlog de capacidades no incluidas en las fases activas. Ver `docs/planning.md` para tareas en curso y `docs/primesight_indicators_catalog.csv` para el detalle de los 102 indicadores y sus fases de implementación.

Prioridad: **P0** crítico · **P1** alto valor · **P2** medio plazo · **P3** experimental
Dificultad: Low / Medium / High / Very High

---

## Estado de implementación por fase

| Fase | Contenido | Estado |
|------|-----------|--------|
| Fase 1 — Base | Player scouting, OAuth2, sync, dashboard, CI/CD | ✅ Completo |
| Fase 2 — Teams | Teams management CRUD, PrimeSight design system, docs | ✅ Completo |
| Fase 3 — Event stream | heroKills/objectives/wards sync, heatmaps, métricas temporales | 🔜 Próxima |
| Fase 4 — Draft/Scouting | Hero pool, comfort scores, ban vulnerability, rival threat | 📋 Planificado |
| Fase 5 — Build/Stat | Calculadora de stats, simulador de builds | 📋 Planificado |

---

## 0. OAuth2 login con pred.gg ✅ COMPLETADO

- Implementado con PKCE (RFC 7636), HTTP-only cookies, refresh automático 30 días.
- Hallazgo clave: iniciar en `https://pred.gg/oauth2/authorize` (ruta SPA), no en `/api/`.
- Scopes: `offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read`

---

## 1. Event stream sync + heatmaps (Fase 3)

- **Priority:** P0
- **Difficulty:** High
- **Contexto:** El event stream de pred.gg está confirmado disponible con auth Bearer. Ver `docs/primesight_visual_design_direction.md` sección "Limitaciones conocidas" y `docs/primesight_indicators_catalog.csv` columna `data_dependency`.
- **Lo que incluye:**
  - Extender sync worker: heroKills, objectiveKills, structureDestructions, wardPlacements/Destructions, goldEarnedAtInterval, transactions, heroBans (solo RANKED)
  - Almacenar eventos individuales por partida en BD (nueva tabla o columnas JSONB)
  - Definir polígonos de zonas tácticas sobre el mapa (entrada Fangtooth, zona Prime, carriles)
  - Panel de heatmap sobre `assets/maps/map.png` con capas por evento
  - Métricas de Fase 2: Deaths Before Objective (IND-018), Gold Diff @5/10/15/20 (TEAM-005), Objective Control (TEAM-008/009/010)
- **Bloqueador conocido:** el sync Bearer token solo está disponible cuando el usuario tiene sesión activa.

---

## 2. Nombres personalizados para jugadores sin cuenta pred.gg (Tarea 5)

- **Priority:** P0
- **Difficulty:** Low
- **Contexto:** El 60% de jugadores en el event stream tienen `name=null` (sin cuenta pred.gg, típicamente consola). Sus UUID y stats son accesibles, solo falta el nombre.
- **Lo que incluye:**
  - Migration: campo `customName String?` en tabla `Player`
  - Endpoint `PATCH /players/:id/name` — actualiza `customName`, nunca sobreescrito por sync
  - Lógica display: `customName ?? displayName ?? "Unknown"`
  - UI: icono de edición junto al nombre en roster y scouting para jugadores sin nombre

---

## 3. Logo upload de equipos (Tarea 5)

- **Priority:** P1
- **Difficulty:** Low
- **Contexto:** El campo `logoUrl` existe en el modelo `Team`. Actualmente solo se puede introducir una URL manualmente en el formulario. Falta soporte para subida de imagen.
- **Opciones:** URL externa (ya funciona), upload a un bucket S3/R2, o base64 inline.

---

## 4. Real-time draft assistant

- **Priority:** P0
- **Difficulty:** High
- **Estimated time:** 8–12 semanas
- **Contexto:** Los bans están disponibles en pred.gg (RANKED, hero+team sin orden). Los picks se infieren de matchPlayers. No hay secuencia de draft. El análisis de composición (estilos, balance de daño) es viable — ver IND-031/032/033 y TEAM-023/024/025 en el catálogo.
- **Lo que se necesita:**
  - Base de datos manual de arquetipos de héroe (engage/poke/scaling/dive) actualizada por parche
  - Cálculo de Hero Comfort Score por jugador-héroe (IND-031)
  - Ban Vulnerability Score (IND-033) — qué héroes se banean contra cada jugador
  - UI de composición con balance de daño visual (físico/mágico/true/utility)
  - Para draft asistido en tiempo real: sistema de tracking durante el pick/ban en vivo

---

## 5. Team-vs-team scrim prep auto-reports

- **Priority:** P0
- **Difficulty:** Medium
- **Estimated time:** 4–6 semanas
- **Contexto:** El ScrimReport básico existe. Necesita enriquecerse con datos del event stream y métricas del catálogo.
- **Lo que se necesita:**
  - Integrar métricas de Fase 2 (objective control, gold diff, deaths before objective)
  - Rival weak zones (TEAM-022) basadas en heatmaps
  - Threat index por jugador rival (TEAM-029)
  - Exportación PDF o HTML compartible

---

## 6. Opponent strategy fingerprinting

- **Priority:** P1
- **Difficulty:** High
- **Estimated time:** 6–10 semanas
- **Contexto:** Clasificar estilos de equipo — early pressure, objective control, scaling, etc. Se apoya en TEAM-023 (Draft Style Winrate) del catálogo.
- **Lo que se necesita:**
  - Feature engineering sobre event stream (ventanas de objetivos, gold diff, picks)
  - Definición manual de arquetipos validados por el coach
  - Visualización: radar chart o fingerprint visual por equipo

---

## 7. VOD review con tags de coach

- **Priority:** P1
- **Difficulty:** Medium
- **Estimated time:** 4–6 semanas
- **Contexto:** El catálogo define 16 review markers (REV-001 a REV-016): bad_reset, late_rotation, bad_objective_setup, etc. Todos son entradas manuales del coach con timestamp, jugador, severidad y comentario.
- **Lo que se necesita:**
  - Modelo de datos ReviewTag en BD
  - UI de annotación vinculada a partida + minuto
  - Sistema de acceso por rol (staff / jugador afectado / equipo)
  - Integración con métricas automáticas (las alertas de IND-018/019 sugieren qué revisar)

---

## 8. Post-match coaching insights

- **Priority:** P1
- **Difficulty:** High
- **Estimated time:** 6–10 semanas
- **Contexto:** Requiere event stream activo (Fase 3). Comparar partidas propias con umbrales del catálogo (min_sample_matches, métricas por rol).
- **Lo que se necesita:**
  - Baseline por rol/héroe/parche
  - Reglas de alerta configurables
  - Panel de "training priority" (TEAM-030)

---

## 9. Build intelligence con simulación de escenario

- **Priority:** P1
- **Difficulty:** Medium
- **Estimated time:** 5–8 semanas
- **Contexto:** El motor de cálculo base existe en `packages/domain-engine`. Falta UI y cobertura completa de items/pasivas/habilidades.
- **Lo que se necesita:**
  - Motor determinista: stat engine, item/pasiva logic, versioning por parche
  - UI: selección de héroe, nivel, build, skill order
  - Outputs explicables: stats intermedios, spikes, burst window

---

## 10. Alerting y monitoring de rivales

- **Priority:** P2
- **Difficulty:** Medium
- **Estimated time:** 3–5 semanas
- **Lo que es:** alertas cuando un rival cambia su pool de héroes, hay role swaps o cae el rendimiento.
- **Lo que se necesita:**
  - Thresholds de cambio configurables
  - Canales de notificación (in-app + opcional Discord webhook)
  - Audit log de alertas y falsos positivos

---

## 11. Live overlays (timers, objectives)

- **Priority:** P2
- **Difficulty:** Very High
- **Estimated time:** 10–16+ semanas
- **Nota:** Requiere validación de compliance con el juego. Alta complejidad técnica. No prioritario mientras haya brechas en analytics post-partida.

---

## 12. RBAC y workspace multi-equipo

- **Priority:** P2
- **Difficulty:** Medium
- **Estimated time:** 4–7 semanas
- **Contexto:** Las señales visuales de RBAC ya están definidas en `primesight_visual_design_direction.md`. Implementar el backend real con roles staff/coach/player/viewer.
- **Lo que se necesita:**
  - Modelo de roles en BD
  - Middleware de autorización por endpoint
  - UI diferenciada: datos "staff privado" (IND-040) ocultos a jugadores

---

## 13. Narrativa de report con IA asistida

- **Priority:** P3
- **Difficulty:** Medium
- **Estimated time:** 3–6 semanas
- **Lo que es:** resúmenes narrativos auto-generados a partir de métricas estructuradas del scrim report.
- **Lo que se necesita:**
  - Templates de prompt ligados a métricas específicas del catálogo
  - Revisión humana antes de compartir
  - Trazabilidad: cada claim narrativo vinculado a su métrica fuente

---

## Guía de implementación segura

Ruta más segura en función del estado actual:

1. Completar Tarea 5 (logo, customName) — bajo riesgo, alto valor inmediato
2. Extender sync worker con event stream (Tarea 6) — prerequisito de todo lo demás
3. Implementar heatmaps básicos con el mapa ya disponible (`assets/maps/map.png`)
4. Implementar métricas de Fase 2 del catálogo (IND-018, TEAM-005, TEAM-008/009/010)
5. Enriquecer ScrimReport con esas métricas
6. Luego abordar draft analysis con los datos de heroBans ya disponibles
