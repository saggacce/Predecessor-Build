# Reglas de Insights Automáticos — RiftLine

**Versión:** Mayo 2026  
**Módulo:** Analyst (Team Analysis → Performance)  
**Archivo fuente:** `apps/api/src/services/analyst-service.ts`

---

## Cómo funciona el sistema

El motor de análisis evalúa cada equipo OWN contra un conjunto de reglas deterministas. Cada regla produce un **insight** cuando se supera un umbral estadístico. Los insights se ordenan por severidad: `critical → high → medium → low → positive`.

### Datos necesarios para activar las reglas

| Dato | Mínimo | Para qué reglas |
|------|--------|-----------------|
| Jugadores en roster | ≥ 3 activos | Todas |
| Partidas individuales por jugador | ≥ 8 | Reglas 5, 7, 8 |
| Partidas de equipo con event stream | ≥ 3 (con ≥3 jugadores en el mismo lado) | Reglas 1, 2, 3, 4, 6 |

---

## Reglas de análisis de equipo

### Regla 1 — Muertes críticas antes de objetivos mayores
**ID:** `rule-crit-death-obj`  
**Severidad:** 🔴 Critical  
**Categoría:** Macro  
**Datos necesarios:** Event stream (HeroKill + ObjectiveKill)

**Condición de disparo:**  
En ≥ 60% de las partidas analizadas, un jugador del roster muere en los **60 segundos previos** a un objetivo mayor (Fangtooth, Orb Prime, Shaper).

**Recomendación generada:**  
Revisar posicionamiento y timing de setup 90s antes de cada objetivo mayor. Priorizar reset si la ventaja de vida es insuficiente.

---

### Regla 2 — Sin setup de visión antes de objetivos
**ID:** `rule-low-vision-obj`  
**Severidad:** 🟠 High  
**Categoría:** Vision  
**Datos necesarios:** Event stream (WardEvent + ObjectiveKill)

**Condición de disparo:**  
Con ≥ 5 objetivos mayores analizados, el equipo no coloca **ninguna ward** en los **90 segundos previos** al ≥ 50% de los objetivos.

**Recomendación generada:**  
Establecer una rutina de visión obligatoria 90-120s antes de cada Fangtooth/Prime/Shaper. Support y jungla deben iniciar el setup.

---

### Regla 3 — El rival limpia la visión antes de objetivos
**ID:** `rule-vision-cleaned`  
**Severidad:** 🟠 High  
**Categoría:** Vision  
**Datos necesarios:** Event stream (WardEvent + ObjectiveKill)

**Condición de disparo:**  
Con ≥ 5 objetivos mayores analizados, el rival destruye **≥ 2 wards propias** en los **120 segundos previos** al ≥ 40% de los objetivos.

**Recomendación generada:**  
Usar wards de tipo Oracle/Sentry para proteger zonas de visión propia. Colocar wards de backup más tarde para no perder todo el setup.

---

### Regla 4 — Orb Prime sin conversión en estructura
**ID:** `rule-prime-no-conv`  
**Severidad:** 🟠 High  
**Categoría:** Macro  
**Datos necesarios:** Event stream (ObjectiveKill + StructureDestruction)

**Condición de disparo:**  
Con ≥ 3 Orb Primes asegurados por el equipo, el ≥ 50% de ellos no genera ninguna destrucción de estructura (**Inner Tower, Inhibidor o Core**) en los **180 segundos** posteriores.

**Recomendación generada:**  
Definir un protocolo post-Prime: ejecutar split push o ataque de inhibidor inmediatamente. No resetear hasta presionar una estructura.

---

### Regla 5 — Dependencia de draft por jugador
**ID:** `rule-draft-dep-{playerId}`  
**Severidad:** 🟡 Medium  
**Categoría:** Draft  
**Datos necesarios:** ≥ 8 partidas individuales por jugador

**Condición de disparo:**  
Un jugador concentra **≥ 65%** de sus partidas en solo 2 héroes. Alta vulnerabilidad si uno de ellos es baneado.

**Recomendación generada:**  
Ampliar el pool del jugador afectado con al menos 1 héroe adicional viable. Priorizar en sesiones de scrim.

> Se genera **un insight por cada jugador** que cumpla la condición.

---

### Regla 6 — Patrón de throw (ventaja de oro perdida)
**ID:** `rule-throw`  
**Severidad:** 🟠 High  
**Categoría:** Economy  
**Datos necesarios:** Event stream + goldEarnedAtInterval (≥ 3 jugadores OWN y rivales con datos)

**Condición de disparo:**  
En ≥ 2 partidas perdidas, el equipo tuvo en algún momento una **ventaja de +3.000 oro** sobre el rival y no cerró la partida.

**Recomendación generada:**  
Definir una regla de cierre cuando la ventaja supera 3k: priorizar Prime, inhibidor o push coordinado. No dispersarse después de objetivos grandes.

---

### Regla 7 — Bajón de rendimiento individual (slump)
**ID:** `rule-slump-{playerId}`  
**Severidad:** 🟡 Medium  
**Categoría:** Performance  
**Datos necesarios:** ≥ 10 partidas individuales + PlayerSnapshot con KDA histórico

**Condición de disparo:**  
El KDA de las **últimas 10 partidas** del jugador es al menos **1.0 puntos inferior** a su KDA histórico (del snapshot), y el KDA reciente es **< 2.0**.

**Recomendación generada:**  
Revisar partidas recientes para identificar si el problema es de draft, rol, posicionamiento o momento individual.

> Se genera **un insight por cada jugador** que cumpla la condición.

---

### Regla 8 — Actividad de visión por debajo del umbral por rol
**ID:** `rule-vision-gaps`  
**Severidad:** 🟡 Medium  
**Categoría:** Vision  
**Datos necesarios:** ≥ 5 partidas con `wardsPlaced` por jugador

**Umbrales por rol (wards/min):**

| Rol | Referencia | Umbral de disparo |
|-----|-----------|-------------------|
| Support | 1.00 | < 0.65 |
| Jungle | 0.50 | < 0.33 |
| Midlane | 0.35 | < 0.23 |
| Offlane | 0.30 | < 0.20 |
| Carry | 0.25 | < 0.16 |

**Condición de disparo:**  
Uno o más jugadores tienen un promedio de wards/min **inferior al 65% del umbral de su rol**.

**Recomendación generada:**  
Establecer objetivos individuales de visión. En scrims, contar wards colocadas por support y jungla antes de cada objetivo.

---

### Regla 9a — Control de Fangtooth destacado (positivo)
**ID:** `rule-positive-ft`  
**Severidad:** 🟢 Positive  
**Categoría:** Macro  
**Datos necesarios:** Event stream (ObjectiveKill)

**Condición de disparo:**  
Con ≥ 5 Fangtoots disputados, el equipo controla **≥ 70%** de ellos.

---

### Regla 9b — Dominio de Prime (positivo)
**ID:** `rule-positive-prime`  
**Severidad:** 🟢 Positive  
**Categoría:** Macro  
**Datos necesarios:** Event stream (ObjectiveKill)

**Condición de disparo:**  
Con ≥ 5 objetivos de Prime (Mini + Orb) disputados, el equipo controla **≥ 70%** de ellos.

---

### Regla 10 — Estado de datos del análisis (siempre visible)
**ID:** `data-status`  
**Severidad:** ⬜ Low  
**Categoría:** Performance

Siempre se genera este insight informativo indicando qué datos están disponibles y cuáles faltan para activar las reglas completas.

---

## Resumen de umbrales

| Regla | Umbral principal | Datos clave |
|-------|-----------------|-------------|
| 1. Deaths pre-objetivo | 60% de partidas | HeroKill ≤60s antes de ObjectiveKill |
| 2. Sin visión pre-objetivo | 50% de objetivos | 0 wards en 90s previos |
| 3. Visión limpiada | 40% de objetivos | ≥2 wards destruidas en 120s previos |
| 4. Prime no convertido | 50% de Primes | Sin estructura en 180s posteriores |
| 5. Dependencia de draft | 65% en 2 héroes | ≥8 partidas por jugador |
| 6. Throw | 2+ partidas perdidas | Gold lead >3.000 en partidas perdidas |
| 7. Slump | -1.0 KDA vs histórico | KDA reciente <2.0 + snapshot histórico |
| 8. Wards/min bajas | <65% del umbral de rol | ≥5 partidas con wardsPlaced |
| 9a. Fangtooth positivo | ≥70% de control | ≥5 disputados |
| 9b. Prime positivo | ≥70% de control | ≥5 disputados |

---

## Objetivos reconocidos como "mayores"

`FANGTOOTH`, `PRIMAL_FANGTOOTH`, `ORB_PRIME`, `MINI_PRIME`, `SHAPER`

*(Los Seedlings no se consideran objetivos mayores en el análisis de visión y conversiones.)*

---

## Scrim Report — Win Conditions generadas automáticamente

El Scrim Report genera **3 Win Conditions** prescriptivas a partir del perfil de scouting del equipo rival, usando la función `WinConditions` en `ScrimReport.tsx`:

| Condición | Trigger | Win Condition generada |
|-----------|---------|----------------------|
| Fase débil temprana | `weakPhase === 'early'` | "Presión de carril temprana — dominar la fase de laning" |
| Fase débil media | `weakPhase === 'mid'` | "Ampliar ventaja de oro en mid game con control de objetivos" |
| Fase débil tardía | `weakPhase === 'late'` | "Cerrar partidas antes de los 30 min — evitar late game del rival" |
| Throw rate alto (>25%) | `throwRate > 25` | "Identificar y presionar throws del rival — convertir ventajas" |
| Baja defensa de Fangtooth | Control rival <40% | "Priorizar Fangtooth en cada spawn — control macro temprano" |
| Rol débil detectado | `weakRole !== null` | "Explotar el rol débil rival ({rol}) con presión constante" |

*(Siempre se muestran exactamente 3 condiciones, priorizadas por impacto.)*

---

## Categorías de Insights en el sistema de Review Queue

Cuando un insight tiene `reviewRequired: true`, se puede crear automáticamente un Review Item con las siguientes categorías:

| Categoría | Insights que la usan |
|-----------|---------------------|
| `macro` | Deaths pre-objetivo, Prime no convertido, Throw, control de objetivos |
| `vision` | Sin visión pre-objetivo, visión limpiada, wards bajas |
| `draft` | Dependencia de draft |
| `performance` | Slump, estado de datos |
| `economy` | Throw pattern |
