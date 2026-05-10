# Future Features Roadmap — PrimeSight

Backlog de funcionalidades pendientes o posibles a futuro para la plataforma PrimeSight / Predecessor-Build.

Este documento complementa:
- `docs/planning.md` → tareas activas y desglose operativo.
- `docs/project_predecessor.md` → especificación de producto.
- `docs/predecessor_api_technical_doc.md` → referencia técnica de pred.gg.
- GitHub Issues → unidad de trabajo accionable.

> Principio rector: **reglas deterministas primero, IA solo para resumir evidencias ya calculadas**. Evitar predicciones falsas o claims no trazables.

---

## Estado general

| Área | Estado | Referencia |
|---|---|---|
| OAuth2 pred.gg, player scouting, teams, dashboard, match detail, timeline, analysis tab | Completo / base existente | `README.md`, `docs/planning.md` |
| Tests pendientes de agregación/filtros | Pendiente | #47 |
| Player sync para UUIDs sin nombre | Pendiente | #48 |
| Analyst Rules Engine | Pendiente | #49 |
| Review Queue + goals | Pendiente | #51 |
| Tactical map zones | Pendiente | #52 |
| Tactical Board | Pendiente | #53 |
| Tactical Timeline | Pendiente | #54 |
| VOD & Replay Index | Pendiente | #56 |
| RBAC + invitations | Pendiente | #57 |
| Pre-Match Battle Plan | Pendiente | #58 |
| Draft Board | Pendiente | #59 |
| Build/Stat Calculator | Pendiente | #60 |
| Game data version manager | Pendiente | #61 |
| Discord Companion Bot | Pendiente | #62 |
| UI/UX V2 + Coach Session Mode | Pendiente | #63 |
| Scrim Planner + Playbook + Review Sessions | Futuro | #64 |

---

## Prioridades

- **P0 — Base crítica:** necesario para fiabilidad, datos o flujo principal.
- **P1 — Alto valor:** mejora fuerte para coaches/staff.
- **P2 — Medio plazo:** útil, pero no bloquea el core.
- **P3 — Experimental:** requiere validación o depende de datos/uso real.

---

# P0 — Base crítica

## 1. Tests de agregación y filtros por parche/ventana

**Issue:** #47  
**Estado:** Pendiente  
**Motivo:** sin estos tests, el Rules Engine y los reportes pueden mezclar muestras incorrectas por parche, timeframe o modo.

Incluye:
- tests de agregación de métricas de jugador;
- tests de filtros por parche y ventana temporal;
- casos de muestra baja, dataset vacío y jugadores privados/nulos.

---

## 2. Sync de jugadores desconocidos del event stream

**Issue:** #48  
**Estado:** Pendiente  
**Motivo:** jugadores de consola/privados pueden aparecer con UUID pero sin nombre. Deben persistirse para análisis, roster, review y scouting.

Incluye:
- crear placeholders de `Player` para UUIDs del event stream;
- preservar `customName`;
- fallback de display consistente.

---

## 3. Analyst Rules Engine MVP

**Issue:** #49  
**Estado:** Pendiente  
**Motivo:** es el puente entre datos descriptivos y acciones reales para staff.

Incluye reglas deterministas para:
- muertes críticas antes de objetivos;
- baja visión antes de objetivos;
- visión limpiada por el rival;
- Prime no convertido;
- draft dependency / ban vulnerability;
- throws tras ventaja de oro;
- player slump;
- gaps de visión;
- refuerzos positivos.

Salida esperada:
```ts
{
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  category: string;
  title: string;
  evidence: Evidence[];
  recommendation: string;
  reviewRequired: boolean;
}
```

---

## 4. Tactical map zones

**Issue:** #52  
**Estado:** Pendiente  
**Motivo:** varias métricas avanzadas dependen de saber si un evento ocurrió cerca de Fangtooth, Prime, Shaper, río, carriles o jungla.

Incluye:
- polígonos tácticos sobre el mapa calibrado;
- tabla/modelo `MapZone`;
- función `pointInZone(x, y, zone)` en `domain-engine`;
- tests de coordenadas.

---

## 5. RBAC, invitaciones y perfiles de usuario

**Issue:** #57  
**Estado:** Pendiente  
**Motivo:** necesario para multiusuario real, visibilidad privada de objetivos, roles staff/jugador y uso por equipos.

Incluye:
- `User`;
- `Invitation`;
- `TeamMembership`;
- roles globales y por equipo;
- middleware de autorización.

---

# P1 — Alto valor para coaches/staff

## 6. Review Queue + Team/Player Goals

**Issue:** #51  
**Estado:** Pendiente  
**Depende de:** #49 para máximo valor.

Convierte insights/eventos en trabajo de revisión:
```text
Insight/evento → ReviewItem → coach confirma/descarta → tag causa → action item → TeamGoal/PlayerGoal
```

Incluye:
- cola de review filtrable;
- estados de revisión;
- tags manuales;
- objetivos de equipo y jugador;
- visibilidad privada por rol.

---

## 7. Pre-Match Intelligence: Battle Plan

**Issue:** #58  
**Estado:** Pendiente  
**Depende de:** #49 y, para mejores mapas/zonas, #52.

Mejora el Scrim Report hacia una vista prescriptiva:
- VS con logos;
- timeframe / patch filter;
- win conditions;
- target players;
- objective plan;
- avoid list;
- roster validator;
- export/share view.

---

## 8. Draft Board, hero pools y ban recommendations

**Issue:** #59  
**Estado:** Pendiente

Incluye:
- hero pool por jugador;
- comfort score;
- ban vulnerability;
- recommended bans;
- composition board;
- saved draft plans;
- patch-aware filtering.

No incluye en MVP:
- live draft automation;
- inferir orden real de picks/bans cuando la API no lo expone.

---

## 9. Tactical Board

**Issue:** #53  
**Estado:** Pendiente

Pizarra libre sobre mapa para:
- setups de Fangtooth/Prime/Shaper;
- zonas de peligro;
- flechas de rotación;
- puntos de engage/reset;
- notas de coach;
- exportación a imagen.

No es replay ni tracking de posiciones.

---

## 10. Tactical Timeline con anotaciones

**Issue:** #54  
**Estado:** Pendiente  
**Depende de:** #51 para crear Review Items desde eventos.

Diferente al Timeline tab actual:
- orientado a sesión de review;
- permite anotaciones;
- filtra por objetivo/ventana temporal;
- crea Review Items desde eventos.

---

## 11. VOD & Replay Index

**Issue:** #56  
**Estado:** Pendiente

Índice de enlaces externos, no hosting de vídeo:
- full match;
- player POV;
- clip;
- coach review;
- scrim recording;
- tournament VOD;
- in-game replay reference.

Debe soportar timestamps de vídeo y game time.

---

## 12. UI/UX V2 + Coach Session Mode

**Issue:** #63  
**Estado:** Pendiente

Incluye:
- OWN/RIVAL color system;
- hover/highlight en tablas;
- pocket pick highlight;
- team status badges;
- quick report buttons;
- dashboard más compacto;
- Coach Session Mode para proyectar en Discord/review.

---

# P2 — Medio plazo

## 13. Discord Companion Bot

**Issue:** #62  
**Estado:** Pendiente  
**Depende de:** #49 y #51 para mayor valor.

El bot consume datos procesados por PrimeSight. No calcula analytics.

MVP:
- vincular guild ↔ team;
- configurar canales;
- enviar match summaries;
- enviar critical review alerts;
- slash commands básicos.

Regla: sin permiso Administrator y sin spam.

---

## 14. Scrim Planner, Playbook y Review Sessions

**Issue:** #64  
**Estado:** Futuro  
**Depende de:** #51, #53 y #59.

Capa superior de Team Tools:
- planificación de scrims con focus area;
- playbook de estrategias/setups/draft plans;
- review sessions con agenda, boards, review items y action items.

---

## 15. Build/Stat Calculator MVP

**Issue:** #60  
**Estado:** Pendiente  
**Relacionado con:** #61.

Permite seleccionar:
- versión;
- héroe;
- nivel;
- rol;
- crest/items;
- skill order.

Devuelve:
- base stats;
- bonus stats;
- final stats;
- ability values para daño/heal/shield cuando el dato esté soportado;
- explicaciones de fórmula.

Regla crítica: **no fingir pasivas no soportadas**. Etiquetarlas como unsupported/partial.

---

## 16. Game Data Version Manager + update checker

**Issue:** #61  
**Estado:** Pendiente

Necesario para que el Build/Stat Calculator y los reportes sean reproducibles por parche.

Incluye:
- versiones importadas;
- versión por defecto;
- archivar/borrar versión;
- advertencia si hay builds/presets/comparativas dependientes;
- checker automático de nuevas versiones;
- import manual tras validación.

---

# P3 — Experimental / futuro avanzado

## 17. Matchup evaluator explicable

**Estado:** Futuro  
**Depende de:** Build/Stat Calculator estable (#60).

Debe producir ventaja/riesgo, no “ganador garantizado”.

Dimensiones posibles:
- burst;
- sustained DPS;
- durability/effective health;
- mobility/disengage;
- crowd control pressure;
- timing por nivel/item spike.

---

## 18. AI-assisted summaries

**Estado:** Futuro  
**Depende de:** Rules Engine (#49).

Uso permitido:
- resumir evidencias;
- generar texto de reporte;
- convertir insights en narrativa entendible.

Uso prohibido:
- inventar causalidad;
- generar recomendaciones no trazables;
- sustituir reglas deterministas.

---

## 19. Opponent strategy fingerprinting

**Estado:** Futuro

Clasificar estilos de rival:
- early pressure;
- objective control;
- scaling;
- dive/pick;
- vision denial;
- weak-side tendencies.

Debe basarse en features del event stream y validación manual del coach.

---

## 20. Alerting y monitoring de rivales

**Estado:** Futuro

Alertas cuando:
- rival cambia hero pool;
- role swap;
- aparece nuevo jugador;
- cae/sube rendimiento;
- cambia tendencia de bans/picks.

Canales posibles:
- in-app;
- Discord;
- email opcional.

---

## 21. Live overlays / live draft mode

**Estado:** Experimental  
**Riesgo:** alto.

Antes de implementar:
- revisar compliance con el juego/torneos;
- validar utilidad real;
- evitar overlays que puedan considerarse ventaja indebida.

---

## 22. Funcionalidades explícitamente NO prioritarias

| Funcionalidad | Motivo |
|---|---|
| Predicción exacta de ganador | No es fiable ni explicable con datos disponibles. |
| Pathing continuo de jugadores | La API expone eventos puntuales, no trayectoria continua. |
| POV automático desde replay | No hay soporte oficial directo. Usar VOD Index. |
| IA generativa como motor principal | Primero reglas deterministas. |
| Simulación completa de teamfight | Complejidad muy alta; no necesaria para MVP. |
| Migración automática de builds entre parches | Puede romper semántica si cambian ítems/stats/pasivas. |

---

## Orden recomendado de implementación

1. #47 — Tests de agregación/filtros.
2. #48 — Crear jugadores para UUIDs desconocidos.
3. #49 — Analyst Rules Engine.
4. #52 — Tactical map zones.
5. #51 — Review Queue + goals.
6. #58 — Battle Plan.
7. #59 — Draft Board.
8. #56 — VOD & Replay Index.
9. #57 — RBAC/invitations.
10. #63 — UI/UX V2 + Coach Session Mode.
11. #53 / #54 — Tactical Board y Tactical Timeline.
12. #60 / #61 — Build/Stat Calculator + Version Manager.
13. #62 — Discord Companion Bot.
14. #64 — Scrim Planner + Playbook + Review Sessions.

---

## Nota de mantenimiento

Cuando una funcionalidad pase a estar en desarrollo activo, debe moverse o detallarse en `docs/planning.md`. Este roadmap debe mantenerse como backlog de capacidades pendientes/futuras, no como tablero operativo diario.
