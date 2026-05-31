# PrimeSight — Insights Individuales Batch 2

**Versión:** 1.0  
**Fecha:** 2026-05-31  
**Estado:** Parcialmente implementado — ver sección 1 para implementados, sección 2 para pendientes.

---

## 1. Implementados en Batch 2 (PR #245)

| ID | Categoría | Descripción |
|---|---|---|
| `rule-first-death-rate-{id}` | Performance / Risk | El jugador muere primero ≥40% de partidas |
| `rule-early-death-rate-{id}` | Performance / Risk | El jugador muere antes de 10min en ≥35% |
| `rule-death-before-obj-player-{id}` | Macro | El jugador muere antes de objetivo mayor ≥30% |
| `rule-low-vision-share-{id}` | Vision | Contribución de wards < 60% del esperado por rol |
| `rule-low-ward-clear-share-{id}` | Vision | Limpieza de wards < 55% del esperado por rol |
| `rule-vision-drop-{id}` | Vision / Trend | Bajón >30% en wards/min recientes vs histórico |
| `rule-positive-vision-improvement-{id}` | Vision ✅ | Mejor mejora en visión del equipo |
| `rule-low-objective-dmg-share-{id}` | Macro | Daño a objetivos < 50% del esperado por rol |
| `rule-low-structure-dmg-share-{id}` | Macro | Daño a estructuras < 50% del esperado por rol |
| `rule-no-objective-impact-after-lead-{id}` | Macro | Ventaja de oro sin convertir en objetivos |
| `rule-high-objective-impact-{id}` | Macro ✅ | Mejor impacto en objetivos del equipo |
| `rule-high-structure-pressure-{id}` | Macro ✅ | Mejor presión a estructuras |
| `rule-high-gold-low-kp-{id}` | Economy | Mucho oro, baja kill participation |
| `rule-high-gold-high-death-{id}` | Economy / Risk | Muchos recursos y muchas muertes |
| `rule-positive-efficiency-{id}` | Performance ✅ | Mejor ratio impacto/recursos |
| `rule-low-cs-role-{id}` | Economy | CS < 65% del esperado para su rol |
| `rule-cs-drop-{id}` | Economy / Trend | Bajón >25% de CS en partidas recientes |
| `rule-positive-farm-consistency-{id}` | Economy ✅ | Farm consistente y estable |
| `rule-low-hero-pool-depth-{id}` | Draft | Pool limitado (<3 héroes con ≥3 partidas) |
| `rule-comfort-overreliance-{id}` | Draft | Dependencia excesiva de un héroe en 60%+ partidas |

---

## 2. Pendientes para fases futuras

### 2.1 Riesgo — requieren análisis espacial

| ID | Descripción | Qué falta |
|---|---|---|
| `rule-death-without-vision-{id}` | El jugador muere sin visión cercana | Cruzar `HeroKill.location` con `WardEvent` activos en ese momento (cálculo de vida de wards) |
| `rule-repeated-death-zone-{id}` | El jugador muere repetidamente en la misma zona | Clustering espacial + `MapZone` polygons |

### 2.2 Visión — requieren análisis espacial/temporal

| ID | Descripción | Qué falta |
|---|---|---|
| `rule-low-vision-before-obj-player-{id}` | El jugador no contribuye al setup de visión antes de objetivos | `WardEvent` cerca del objetivo por location + time window |

### 2.3 Teamfights — requieren teamfight clustering

Todos dependen de detectar teamfights automáticamente (grupos de kills en ventana de ~30s y área similar):

| ID | Descripción |
|---|---|
| `rule-carry-first-death-fight-{id}` | El carry muere primero en teamfights |
| `rule-player-first-death-fight-{id}` | El jugador suele ser primera baja en teamfights |
| `rule-low-teamfight-kp-{id}` | Baja participación en teamfights |
| `rule-high-teamfight-deaths-{id}` | Muertes elevadas en teamfights |
| `rule-positive-teamfight-impact-{id}` | Alto impacto en teamfights ✅ |

**Prerequisito:** implementar `TeamfightCluster` — detectar grupos de HeroKills con gameTime delta < 30s y location cluster.

### 2.4 Farm/economía — requieren benchmarks por rol

| ID | Descripción | Qué falta |
|---|---|---|
| `rule-low-dmg-share-role-{id}` | Bajo Damage Share para su rol | Benchmarks por rol con suficiente histórico |
| `rule-gpm-low-role-{id}` | GPM bajo para su rol | Benchmarks por rol |

### 2.5 Hero pool — parcialmente manual

| ID | Descripción | Qué falta |
|---|---|---|
| `rule-no-ready-backup-pick-{id}` | Sin pick alternativo listo | Requiere evaluación manual del coach |
| `rule-hero-performance-drop-{id}` | Bajón con un héroe específico | Snapshots históricos por héroe (no solo el último) |
| `rule-positive-hero-pool-growth-{id}` | Aumenta hero pool competitivo ✅ | Tracking de nuevos héroes con muestra suficiente |

### 2.6 Comparativa por rol — requieren benchmarks

| ID | Descripción | Visibilidad recomendada |
|---|---|---|
| `rule-role-underperformance-{id}` | Rendimiento bajo frente a benchmark del rol | Staff-only por defecto |
| `rule-role-overperformance-{id}` | Rendimiento superior al benchmark del rol ✅ | Todos |
| `rule-role-risk-profile-{id}` | Perfil de riesgo alto para su rol | Staff-only |

---

## 3. Mínimos de muestra recomendados

| Tipo de insight | Mínimo para mostrar | Confianza media | Confianza alta |
|---|---:|---:|---:|
| Rendimiento individual general | 3 partidas | 10 partidas | 20+ partidas |
| Tendencias individuales | 5 recientes + histórico | 10 recientes + 10 anteriores | 20 recientes |
| Muertes antes de objetivos | 5 objetivos mayores | 10 objetivos | 20+ objetivos |
| Visión individual | 3 partidas | 10 partidas | 20+ partidas |
| Teamfight individual | 5 clusters | 10 clusters | 20+ clusters |
| Hero pool por héroe | 3 partidas con héroe | 5-9 partidas | 10+ partidas |
| Hero pool global | 5 partidas | 10 partidas | 20+ partidas |
| Comparativa por rol | 5 partidas | 10-19 partidas | 20+ partidas |

---

## 4. Principio de visibilidad

Los insights negativos individuales **no deben mostrarse automáticamente al jugador sin validación previa del coach/analista**.

Flujo ideal:
```
Insight individual → Review del coach/analista → Player Goal / Coach Feedback → Seguimiento
```

| Tipo de insight | Manager | Coach | Analista | Player |
|---|:---:|:---:|:---:|:---:|
| Riesgo individual crítico | Sí | Sí | Sí | Solo si validado |
| Muerte antes de objetivo | Sí | Sí | Sí | Si se comparte |
| Vision Share bajo | Resumen | Sí | Sí | Si se comparte |
| Efficiency Gap bajo | Sí | Sí | Sí | Solo si se explica bien |
| Teamfight (batch 3) | Sí | Sí | Sí | Si se valida |
| Insights positivos ✅ | Sí | Sí | Sí | Sí |
