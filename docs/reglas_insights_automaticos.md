# Reglas de Insights Automáticos — RiftLine

**Versión:** Mayo 2026  
**Módulo:** Analyst (Team Analysis → Analyst tab, Dashboard coach)  
**Archivos clave:**
- `apps/api/src/services/analyst-service.ts` — lógica de cómputo
- `apps/api/src/services/insight-strings.ts` — textos EN/ES de todas las reglas
- `apps/api/src/routes/analyst.ts` — endpoint `GET /analysis/insights/:teamId?lang=`

---

## Arquitectura del sistema

El motor de análisis evalúa cada equipo OWN contra un conjunto de reglas deterministas. Cada regla produce un **insight** cuando se supera un umbral estadístico. Los insights se ordenan por severidad: `critical → high → medium → low → positive`.

### Separación lógica / texto (i18n)

Los strings de usuario (título, cuerpo, evidencias, recomendación) **nunca se escriben en `analyst-service.ts`**. Todo el texto vive en `insight-strings.ts`, con una entrada por regla:

```typescript
// insight-strings.ts
'rule-crit-death-obj': (lang: InsightLang, vars: { critPct: number; ... }) => {
  if (lang === 'en') return { title: '...', body: '...', evidence: [...], recommendation: '...' };
  return { /* Spanish */ };
}
```

El endpoint acepta `?lang=en` (o `?lang=es`, el valor por defecto). El frontend pasa `i18n.language` automáticamente.

### Datos necesarios para activar las reglas

| Dato | Mínimo | Para qué reglas |
|------|--------|-----------------|
| Jugadores en roster | ≥ 3 activos | Todas |
| Partidas de equipo con event stream | ≥ 3 (con ≥3 jugadores en el mismo lado) | Reglas 1–4, 6, Grupos A–D, H |
| Partidas individuales por jugador | ≥ 5–10 según regla | Reglas 5, 7, Grupo E |
| Objetivos mayores disputados | ≥ 5 | Reglas 2, 3, 9a, 9b |

---

## Reglas de análisis de equipo

### Regla 1 — Muertes críticas antes de objetivos mayores
**ID:** `rule-crit-death-obj` · **Severidad:** 🔴 Critical · **Categoría:** Macro  
**Condición:** En ≥ 60% de las partidas, un jugador del roster muere en los **60s previos** a un objetivo mayor (Fangtooth, Prime, Shaper).

---

### Regla 2 — Sin setup de visión antes de objetivos
**ID:** `rule-low-vision-obj` · **Severidad:** 🟠 High · **Categoría:** Vision  
**Condición:** Con ≥ 5 objetivos mayores analizados, el equipo no coloca ninguna ward en los **90s previos** al ≥ 50% de ellos.

---

### Regla 3 — El rival limpia la visión antes de objetivos
**ID:** `rule-vision-cleaned` · **Severidad:** 🟠 High · **Categoría:** Vision  
**Condición:** Con ≥ 5 objetivos, el rival destruye ≥ 2 wards propias en los **120s previos** al ≥ 40% de los objetivos.

---

### Regla 4 — Orb Prime sin conversión en estructura
**ID:** `rule-prime-no-conv` · **Severidad:** 🟠 High · **Categoría:** Macro  
**Condición:** Con ≥ 3 Primes asegurados, el ≥ 50% no genera destrucción de estructura (Inner Tower, Inhibidor o Core) en los **180s** posteriores.

---

### Regla 5 — Dependencia de draft por jugador
**ID:** `rule-draft-dep` · **Severidad:** 🟡 Medium · **Categoría:** Draft  
**Condición:** Un jugador concentra ≥ 65% de sus partidas en solo 2 héroes. Se genera un insight **por jugador** que cumpla la condición.

---

### Regla 6 — Patrón de throw (ventaja de oro perdida)
**ID:** `rule-throw` · **Severidad:** 🟠 High · **Categoría:** Economy  
**Condición:** En ≥ 2 partidas perdidas, el equipo tuvo en algún momento una ventaja de **+3.000 oro** y no cerró la partida.

---

### Regla 7 — Bajón de rendimiento individual (slump KDA)
**ID:** `rule-slump` · **Severidad:** 🟡 Medium · **Categoría:** Performance  
**Condición:** KDA de las últimas 10 partidas al menos **1.0 punto inferior** al KDA histórico del jugador, y KDA reciente < 2.0. Un insight **por jugador**.

---

### Regla 8 — Wards/min por debajo del umbral por rol
**ID:** `rule-vision-gaps` · **Severidad:** 🟡 Medium · **Categoría:** Vision

| Rol | Umbral de disparo |
|-----|-------------------|
| Support | < 0.65 wards/min |
| Jungle | < 0.33 wards/min |
| Midlane | < 0.23 wards/min |
| Offlane | < 0.20 wards/min |
| Carry | < 0.16 wards/min |

---

### Regla 9a — Control de Fangtooth destacado (positivo)
**ID:** `rule-positive-ft` · **Severidad:** 🟢 Positive · **Categoría:** Macro  
**Condición:** Con ≥ 5 Fangtoots disputados, el equipo controla ≥ 70% de ellos.

### Regla 9b — Dominio de Prime (positivo)
**ID:** `rule-positive-prime` · **Severidad:** 🟢 Positive · **Categoría:** Macro  
**Condición:** Con ≥ 5 Primes disputados (Mini + Orb), el equipo controla ≥ 70%.

---

## Grupos de reglas extendidas

### Grupo A — Muertes pre-objetivo por rol específico
**ID:** `rule-role-death-obj` (Jungla / Support / Carry) · **Severidad:** 🟠 High · **Categoría:** Macro  
Variantes de Regla 1 focalizadas por rol cuando hay suficientes muestras por posición.

**ID:** `rule-multi-death-obj` · **Severidad:** 🔴 Critical · **Categoría:** Macro  
Cuando múltiples jugadores mueren juntos antes del objetivo (≥ 2 bajas simultáneas).

---

### Grupo B — Visión detallada
**ID:** `rule-late-vision-setup` · **Severidad:** 🟠 High · **Categoría:** Vision  
El equipo coloca las wards demasiado tarde (< 30s antes del objetivo en vez de ≥ 90s).

**ID:** `rule-no-backup-vision` · **Severidad:** 🟡 Medium · **Categoría:** Vision  
No hay visión de respaldo: el equipo pierde toda visión de zona en las últimas horas antes de un objetivo mayor.

**ID:** `rule-vision-lost-no-recovery` · **Severidad:** 🟡 Medium · **Categoría:** Vision  
La visión se pierde (wards destruidas) y el equipo no la repone antes del siguiente objetivo.

---

### Grupo C — Conversión post-objetivo
**ID:** `rule-obj-no-structure` · **Severidad:** 🟠 High · **Categoría:** Macro  
Variante de Regla 4 para **Fangtooth** y **Shaper**: el equipo asegura el objetivo pero no convierte en estructura en los 120s posteriores.

---

### Grupo D — Correlación muertes / objetivos
**ID:** `rule-obj-lost-after-death` · **Severidad:** 🟠 High · **Categoría:** Macro  
El equipo pierde un objetivo mayor en los 90s siguientes a una muerte propia.

**ID:** `rule-obj-taken-after-kill` · **Severidad:** 🟢 Positive · **Categoría:** Macro  
El equipo consigue un objetivo mayor en los 90s siguientes a eliminar a un rival (insight positivo, patrón de conversión eficiente).

---

### Grupo E — Métricas individuales
Todos comparten **Severidad:** 🟡 Medium / 🟢 Positive · **Categoría:** Performance.

| ID | Descripción |
|----|-------------|
| `rule-gpm-slump` | GPM del jugador significativamente por debajo de su media histórica |
| `rule-dpm-slump` | DPM del jugador significativamente por debajo de su media histórica |
| `rule-kp-low` | Kill Participation del jugador por debajo del umbral de rol |
| `rule-death-share` | Porcentaje de muertes del equipo concentrado en un solo jugador |
| `rule-gold-low-dmg` | Jugador con alto gasto de oro pero bajo daño relativo (eficiencia económica) |
| `rule-positive-player-form` | 🟢 Jugador en forma positiva — KDA y métricas por encima de su media |

---

### Grupo F — Composición de draft
**ID:** `rule-draft-dmg-imbalance-ap` · **Severidad:** 🟡 Medium · **Categoría:** Draft  
La composición del equipo carece de daño mágico significativo.

**ID:** `rule-draft-dmg-imbalance-ad` · **Severidad:** 🟡 Medium · **Categoría:** Draft  
La composición del equipo carece de daño físico significativo.

---

### Grupo G — Scouting rival
**ID:** `rule-rival-obj-focused` · **Severidad:** 🟠 High · **Categoría:** Macro  
El equipo rival prioriza fuertemente los objetivos mayores (tasa de control > umbral).

**ID:** `rule-rival-weak-defense` · **Severidad:** 🟢 Positive · **Categoría:** Macro  
El equipo rival tiene una defensa de objetivos débil — oportunidad de explotación.

---

### Grupo H — Insights positivos de visión/macro
**ID:** `rule-positive-vision-setup` · **Severidad:** 🟢 Positive · **Categoría:** Vision  
El equipo establece visión de forma consistente y temprana antes de objetivos mayores.

**ID:** `rule-positive-prime-conv` · **Severidad:** 🟢 Positive · **Categoría:** Macro  
El equipo convierte los Orb Primes en estructuras a una tasa superior al umbral.

---

### Estado de datos (siempre presente)
**ID:** `data-status` · **Severidad:** ⬜ Low · **Categoría:** Performance  
Siempre se genera indicando qué datos están disponibles y cuáles faltan para activar las reglas completas (event stream, partidas suficientes, roster activo).

---

## Cómo añadir un nuevo insight

> Ver también: `docs/workflow.md` para el proceso de branch y deploy.

### Paso 1 — Definir la regla en `analyst-service.ts`

Añadir el bloque de cómputo dentro de la función `getTeamInsights`. El bloque calcula las variables necesarias y llama a `insightStrings`:

```typescript
// En analyst-service.ts, dentro de getTeamInsights(teamId, lang):

// Calcular variables
const myPct = pct(casosActivados, totalCasos);
if (totalCasos >= MIN_SAMPLES && myPct >= THRESHOLD) {
  // Ver insight-strings.ts para el texto
  const s = insightStrings['rule-mi-regla'](lang, {
    myPct,
    totalCasos,
    isRival,
    teamRef,
  });
  insights.push({
    id: 'rule-mi-regla',
    severity: 'high',           // critical | high | medium | low | positive
    category: 'macro',          // macro | vision | draft | performance | economy
    title: s.title,
    body: s.body,
    evidence: s.evidence,
    recommendation: s.recommendation,
    reviewRequired: !isRival,   // true si debe aparecer en Review Queue
    affectedPlayers: [],        // opcional
  });
}
```

### Paso 2 — Añadir las cadenas en `insight-strings.ts`

```typescript
// En insight-strings.ts, añadir la entrada al objeto insightStrings:

'rule-mi-regla': (lang, vars: { myPct: number; totalCasos: number; isRival: boolean; teamRef: string }) => {
  if (lang === 'en') return {
    title: vars.isRival
      ? `Rival shows pattern X (${vars.myPct}% of games)`
      : 'Pattern X detected in your team',
    body: vars.isRival
      ? `${vars.teamRef} shows pattern X in ${vars.myPct}% of their ${vars.totalCasos} analyzed games.`
      : `In ${vars.myPct}% of the ${vars.totalCasos} analyzed games, pattern X was observed.`,
    evidence: [
      `${vars.totalCasos} games analyzed`,
      `Activation rate: ${vars.myPct}%`,
    ],
    recommendation: vars.isRival
      ? 'Exploit this weakness by doing Y before each major objective.'
      : 'Address this by implementing routine Z in practice.',
  };
  // Español (rama por defecto)
  return {
    title: vars.isRival
      ? `El rival muestra el patrón X (${vars.myPct}% de partidas)`
      : 'Patrón X detectado en tu equipo',
    body: vars.isRival
      ? `${vars.teamRef} muestra el patrón X en el ${vars.myPct}% de sus ${vars.totalCasos} partidas analizadas.`
      : `En el ${vars.myPct}% de las ${vars.totalCasos} partidas analizadas se detectó el patrón X.`,
    evidence: [
      `${vars.totalCasos} partidas analizadas`,
      `Tasa de activación: ${vars.myPct}%`,
    ],
    recommendation: vars.isRival
      ? 'Explotar esta debilidad haciendo Y antes de cada objetivo mayor.'
      : 'Corregir esto implementando la rutina Z en los entrenamientos.',
  };
},
```

### Paso 3 — Documentar aquí

Añadir la nueva regla en este documento bajo el grupo correspondiente (Grupo A, B, C… o crear uno nuevo si la categoría es distinta).

### Checklist de nueva regla

- [ ] Cómputo añadido en `analyst-service.ts` con sus variables tipadas
- [ ] Entrada añadida en `insight-strings.ts` con ramas `en` y `es`
- [ ] Regla documentada en `docs/reglas_insights_automaticos.md`
- [ ] `ruleId` sigue el formato `rule-nombre-descriptivo` (kebab-case)
- [ ] `reviewRequired: true` si el insight debe aparecer en la Review Queue
- [ ] Typecheck pasa: `npx tsc -p apps/api/tsconfig.json --noEmit`

---

## Resumen de reglas activas

| ID | Severidad | Categoría | Rival |
|----|-----------|-----------|-------|
| `rule-crit-death-obj` | 🔴 Critical | Macro | ✅ |
| `rule-multi-death-obj` | 🔴 Critical | Macro | ✅ |
| `rule-low-vision-obj` | 🟠 High | Vision | ✅ |
| `rule-vision-cleaned` | 🟠 High | Vision | ✅ |
| `rule-prime-no-conv` | 🟠 High | Macro | ✅ |
| `rule-throw` | 🟠 High | Economy | — |
| `rule-role-death-obj` | 🟠 High | Macro | ✅ |
| `rule-late-vision-setup` | 🟠 High | Vision | — |
| `rule-obj-no-structure` | 🟠 High | Macro | — |
| `rule-obj-lost-after-death` | 🟠 High | Macro | — |
| `rule-rival-obj-focused` | 🟠 High | Macro | ✅ solo |
| `rule-draft-dep` | 🟡 Medium | Draft | — |
| `rule-slump` | 🟡 Medium | Performance | — |
| `rule-vision-gaps` | 🟡 Medium | Vision | — |
| `rule-no-backup-vision` | 🟡 Medium | Vision | — |
| `rule-vision-lost-no-recovery` | 🟡 Medium | Vision | — |
| `rule-gpm-slump` | 🟡 Medium | Performance | — |
| `rule-dpm-slump` | 🟡 Medium | Performance | — |
| `rule-kp-low` | 🟡 Medium | Performance | — |
| `rule-death-share` | 🟡 Medium | Performance | — |
| `rule-gold-low-dmg` | 🟡 Medium | Performance | — |
| `rule-draft-dmg-imbalance-ap` | 🟡 Medium | Draft | — |
| `rule-draft-dmg-imbalance-ad` | 🟡 Medium | Draft | — |
| `rule-positive-ft` | 🟢 Positive | Macro | — |
| `rule-positive-prime` | 🟢 Positive | Macro | — |
| `rule-obj-taken-after-kill` | 🟢 Positive | Macro | — |
| `rule-positive-vision-setup` | 🟢 Positive | Vision | — |
| `rule-positive-prime-conv` | 🟢 Positive | Macro | — |
| `rule-positive-player-form` | 🟢 Positive | Performance | — |
| `rule-rival-weak-defense` | 🟢 Positive | Macro | ✅ solo |
| `data-status` | ⬜ Low | Performance | — |

---

## Objetivos reconocidos como "mayores"

`FANGTOOTH`, `PRIMAL_FANGTOOTH`, `ORB_PRIME`, `MINI_PRIME`, `SHAPER`

*(Los Seedlings no se consideran objetivos mayores en el análisis de visión y conversiones.)*

---

## Categorías de Insights en el sistema de Review Queue

Cuando un insight tiene `reviewRequired: true`, puede crear automáticamente un Review Item:

| Categoría | Insights que la usan |
|-----------|---------------------|
| `macro` | Deaths pre-objetivo, Prime no convertido, Throw, control de objetivos |
| `vision` | Sin visión pre-objetivo, visión limpiada, wards bajas, vision gaps |
| `draft` | Dependencia de draft, desequilibrio de daño |
| `performance` | Slump, GPM/DPM bajo, death share, estado de datos |
| `economy` | Throw pattern, gold/damage gap |

---

## Referencias

- `apps/api/src/services/analyst-service.ts` — motor de cómputo
- `apps/api/src/services/insight-strings.ts` — textos multilingüe
- `docs/primesight_indicators_catalog.csv` — catálogo completo de métricas disponibles
- `docs/workflow.md` — proceso de branch, PR y deploy
