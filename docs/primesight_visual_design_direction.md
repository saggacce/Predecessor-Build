# RiftLine Visual Design Direction

Fuente principal: `docs/portal-moba-analytics.html`

## Posicionamiento visual

PrimeSight debe sentirse como una herramienta de staff competitivo, no como una web publica de estadisticas ni como una landing de marketing. La referencia de mercado muestra que cada plataforma destaca en una dimension distinta: iTero en draft, Mobalytics en diagnostico de rendimiento, OP.GG en rapidez/ecosistema, Porofessor en profundidad, U.GG en recomendacion inmediata y STATUP en coaching en tiempo real.

La oportunidad de PrimeSight es combinar tres cualidades:

- **Rapidez operativa**: llegar a valor en segundos.
- **Profundidad para coach/analista**: metricas explicables, heatmaps, VOD review y scouting rival.
- **Identidad propia Predecessor/MOBA**: lanes, objetivos, roles, Prime/Fangtooth, VP/rangos y reportes de scrim.

No debe parecer una copia de pred.gg. pred.gg es una fuente/comunidad de datos; PrimeSight debe parecer una capa privada de inteligencia competitiva construida sobre datos, review y contexto de equipo.

## Personalidad de marca

**Nombre:** PrimeSight  
**Promesa:** Competitive intelligence for Predecessor teams  
**Personalidad:** precisa, tactica, rapida, analitica, seria, gaming sin exceso.

La marca debe comunicar "vemos el mapa antes que el rival". Visualmente esto se traduce en:

- Lineas de mapa/lane sutiles.
- Nucleo Prime como acento de prioridad.
- Datos densos pero jerarquizados.
- Componentes que parecen herramientas de trabajo, no tarjetas decorativas.

## Principios de UX

1. **Zero to value en menos de 5 segundos**
   La primera pantalla debe mostrar estado, parche, ultimos equipos/jugadores o acciones utiles. Evitar pantallas vacias con solo cards de estado.

2. **Progressive disclosure**
   Mostrar primero diagnostico y accion; dejar el detalle para expandir, tabs, drill-down o modales.

3. **Contexto sobre datos**
   Ningun numero importante debe ir solo. Un KDA, winrate, VP, gold diff o objective control debe llevar comparativa, tendencia o significado.

4. **Velocidad como feature**
   Skeletons, feedback inmediato, estados de carga visibles y transiciones cortas. La interfaz debe sentirse ligera.

5. **Feedback siempre visible**
   Sync, errores, cambios de rol, guardados de equipo, tags de review y filtros deben dar respuesta clara.

6. **IA o scores explicables**
   Cuando haya scores avanzados, mostrar de que se componen y con que confianza. Evitar "caja negra".

7. **Mobile utilitario, no secundario**
   En movil priorizar consultas rapidas: jugador, roster, scrim report, metricas clave. No intentar meter dashboards completos sin adaptacion.

## Sistema visual recomendado

### Paleta

Usar una base dark-first como experiencia principal.

| Uso | Color recomendado | Notas |
| --- | --- | --- |
| Background | `#0a0c10` / `#080a0d` | Fondo profundo, no negro puro en superficies extensas. |
| Surface | `#111318` / `#10151b` | Sidebar, headers, barras de contexto. |
| Card | `#1e2330` / `#121821` | Paneles de datos, tablas, dashboards. |
| Primary analysis | `#5b9cf6` | Acciones analiticas, foco primario. |
| Teal / vision | `#14b8a6` / `#38d4c8` | Vision, mapa, conexion, scouting. |
| Violet / intelligence | `#a78bfa` / `#9b7cff` | Rango, draft, profundidad, modelos. |
| Gold / Prime | `#f0b429` / `#f0b35b` | Objetivos, highlights, alertas importantes. |
| Win / improvement | `#4ade80` | Solo victoria/mejora/estado positivo. |
| Loss / risk | `#f87171` / `#ff5d6c` | Solo derrota/deterioro/riesgo. |

Regla clave: verde, rojo y dorado deben ser semanticos. No usar verde para un rol ni rojo para decoracion si tambien indican win/loss/riesgo.

### Tipografia

El estudio propone:

- Display: `Syne` para titulares fuertes.
- Body: `DM Sans` para lectura.
- Mono: `JetBrains Mono` para metricas, IDs, timestamps y formulas.

Para PrimeSight:

- Mantener `Outfit` es aceptable para el MVP porque ya esta integrado y funciona bien en UI.
- A medio plazo, migrar a `DM Sans` + `JetBrains Mono` daria un tono mas producto/analitica.
- No usar titulares gigantes salvo en documentacion o landing. En la app, los H1 deben ser compactos.

Escala recomendada en app:

- Page title: 28-32px, 800.
- Section title: 18-20px, 700.
- Card title: 15-17px, 700.
- Body/control: 13-15px.
- Table/caption/meta: 11-13px.
- Metric mono: 12-14px con `tabular-nums` si se configura CSS.

### Fondo

El fondo puede incluir grid y lineas MOBA, pero siempre sutiles. Debe ayudar a la identidad sin interferir con tablas, graficos ni heatmaps.

Recomendado:

- Grid 44-48px con opacidad muy baja.
- 2-3 diagonales suaves que evoquen lanes.
- Acentos Prime solo en zonas de marca o estado, no en todo el viewport.

Evitar:

- Orbes, glows grandes, fondos demasiado decorativos.
- Gradientes dominantes morado/azul.
- Texturas que compitan con heatmaps.

## Layout de aplicacion

### Sidebar

Debe ser el ancla de marca y navegacion:

- Logo PrimeSight.
- Nombre PrimeSight.
- Sublinea corta: `Competitive Intelligence`.
- Navegacion compacta.
- Estado de login/pred.gg al final.

No repetir el lema completo en la sidebar. La sidebar debe ser funcional y estable.

### Workspace header

Debe ser contextual, no otro bloque de branding.

Contenido recomendado:

- `Predecessor competitive workspace`
- Sublinea operativa: `Scouting, roster analysis and scrim preparation`
- Chip de parche actual.
- Chip de estado pred.gg.
- Futuro: usuario, equipo activo, rol/RBAC, region o modo de trabajo.

Evitar:

- Repetir logo + PrimeSight + lema si ya estan en sidebar.
- Copy tipo marketing dentro de una herramienta operativa.

### Dashboard

El dashboard actual no debe quedarse como tres cards aisladas. Debe evolucionar hacia un panel de entrada operativo:

- Estado API / pred.gg.
- Patch actual.
- Sync controls.
- Actividad reciente.
- Equipos/jugadores recientes.
- Alertas de datos faltantes.
- Atajos a acciones reales.

Hasta tener mas datos, mantenerlo compacto. Mucho espacio vacio debilita la percepcion de producto.

## Componentes clave

### Cards de metrica

Deben ser densas, no decorativas:

- Label pequeno.
- Valor principal.
- Delta/tendencia/contexto.
- Estado semantico.
- Tooltip o detalle expandible para formula.

Ejemplo:

- `Gold Diff @15`
- `+1.2k`
- `Top 28% vs tracked rivals`

### Tablas

PrimeSight va a vivir en tablas. Deben tener prioridad de diseno:

- Headers sticky cuando aplique.
- Densidad media/alta.
- Filas de 40-52px.
- Avatares/heroes/rangos integrados.
- Badges de rol y prioridad.
- Sorting visual.
- Empty states utiles.

No convertir datos tabulares en grids de cards si hay comparacion o ranking.

### Player rows

Para scouting y roster:

- Avatar/heroe o inicial.
- Nombre.
- Rol.
- Rank emblem + VP.
- 2-4 metricas clave.
- Ultima sync o freshness.
- Riesgo/threat/comfort cuando exista.

### Team / roster modules

El roster debe verse como herramienta de gestion:

- Logo equipo.
- Tipo OWN/RIVAL.
- Region.
- Roster activo.
- Roles codificados por color.
- VP/rango como emblema, no texto largo.
- Acciones discretas.

### Heatmaps

Los heatmaps son una pieza diferencial. Deben tener identidad fuerte pero legible:

- Mapa sobre fondo oscuro neutro.
- Capas por evento: deaths, kills, wards, objectives, structures.
- Controles por fase: early/mid/late, pre-objective 30/60/90/120s.
- Leyenda clara.
- Filtros por jugador, rol, heroe, resultado, parche.
- No saturar color; usar intensidad/alpha.

### VOD review tags

Las etiquetas manuales deben parecer parte del sistema, no notas sueltas:

- Tag.
- Severidad.
- Timestamp.
- Jugador/rol.
- Comentario coach.
- Accion requerida.
- Estado.
- Acceso recomendado (staff, equipo, jugador).

Los datos sensibles como actitud/respuesta a feedback deben estar claramente marcados y restringidos.

## Identidad Predecessor/MOBA

Usar referencias de Predecessor desde el lenguaje funcional:

- Roles: carry, jungle, midlane, offlane, support.
- Objetivos: Fangtooth, Primal Fangtooth, Mini Prime, Orb Prime.
- Rango/VP.
- Heatmaps de muertes/vision/objetivos.
- Draft, comfort heroes, hero pool, bans.
- Scrim report y rival scouting.

Evitar:

- Parecer pagina oficial del juego.
- Usar assets oficiales sin control/licencia.
- Sobrecargar la UI con fantasia medieval/sci-fi.
- Introducir iconografia decorativa sin valor funcional.

## Copy y tono

El tono debe ser directo y util:

- "Objective setup risk"
- "Deaths before Fangtooth"
- "Rival weak zone"
- "Prime conversion"
- "Training priority"

Evitar frases vacias:

- "Live performance workspace" como claim fijo.
- "Unleash your potential".
- "Dominate the battlefield".

La app debe hablar como un analista: precisa, concreta, accionable.

## Recomendaciones de implementacion visual

### Corto plazo

1. Mantener PrimeSight en sidebar y favicon.
2. Mantener header superior como contexto de workspace, no branding.
3. Compactar dashboard cuando haya mas datos.
4. Crear estilos compartidos para:
   - metric cards,
   - data tables,
   - chips/badges,
   - role tags,
   - status/sync states.
5. Reducir estilos inline gradualmente para que la marca sea consistente.

### Medio plazo

1. Introducir `JetBrains Mono` para metricas y timestamps.
2. Definir componentes reutilizables:
   - `MetricCard`
   - `DataTable`
   - `PlayerIdentity`
   - `RoleBadge`
   - `RankEmblem`
   - `ObjectiveChip`
   - `HeatmapPanel`
   - `ReviewTag`
3. Crear una pagina de design tokens interna.
4. Definir estados empty/loading/error como componentes de producto.

### Largo plazo

1. Dashboard ejecutivo para staff.
2. Modulo de heatmaps como pieza visual diferencial.
3. Sistema de review con tags y acciones correctivas.
4. RBAC visible en UI: staff, coach, player, viewer.
5. Export/report views para scrim preparation.

## Veredicto sobre la direccion actual

La direccion actual de PrimeSight es valida como base: dark, tactica, con identidad propia y orientada a analisis. Aun necesita evolucionar desde "dashboard visual" hacia "workspace competitivo". La mayor prioridad no es hacerla mas decorativa, sino hacer que cada componente parezca una herramienta de decision para coaches, analistas y jugadores.

---

## Sistema de color para heatmaps

Los heatmaps son la pieza diferencial de PrimeSight. Su paleta debe ser visualmente independiente del sistema de color de la UI para evitar conflictos semanticos (el verde de la UI significa victoria; en un heatmap de densidad de muertes el verde significaria "zona segura", lo que es contrario al uso general del color verde en la plataforma).

### Paleta de densidad para heatmaps

Usar una escala de frio a caliente con alpha variable:

| Densidad | Color | Hex | Uso |
| --- | --- | --- | --- |
| Sin actividad | Transparente | — | Zonas sin eventos |
| Muy baja | Azul profundo | `#1e3a5f` a 40% | Eventos aislados |
| Baja | Cian | `#0e7490` a 55% | Actividad esporadica |
| Media | Verde-amarillo | `#65a30d` a 65% | Patron emergente |
| Alta | Naranja | `#c2410c` a 80% | Zona de riesgo |
| Muy alta | Rojo vivo | `#ef4444` a 95% | Zona critica / hot spot |

Regla: el rojo de heatmap (`#ef4444`) es visualmente diferente del rojo semantico de la UI (`#f87171`). Nunca usar el rojo de heatmap como color de UI y viceversa.

### Capas de heatmap

Cada tipo de evento tiene una paleta propia para poder superponer capas:

| Capa | Paleta base | Notas |
| --- | --- | --- |
| Muertes (propias) | Rojo (`#ef4444`) | Zona de riesgo para el equipo |
| Muertes (rivales) | Verde (`#22c55e`) | Zona de dominio propio |
| Wards colocadas | Azul (`#3b82f6`) | Control de vision |
| Wards destruidas | Naranja (`#f97316`) | Vision negada |
| Objetivos | Dorado (`#f0b429`) | Coherente con gold/Prime en UI |
| Estructuras | Violeta (`#a78bfa`) | |
| Kills | Verde esmeralda (`#10b981`) | |

### Leyenda y controles obligatorios

Cada heatmap debe incluir:

- Leyenda de escala de color visible (frio → caliente).
- N de eventos que representa (ej. "42 muertes en 18 partidas").
- Selector de capa activa.
- Filtros: jugador, rol, heroe, resultado (victoria/derrota), fase (early/mid/late), ventana pre-objetivo (30/60/90/120s).
- Boton de reset de filtros.

---

## Estados de componentes

Todos los componentes de datos deben tener cuatro estados definidos. No son opcionales.

### Loading

Usar skeleton screens, no spinners globales. El skeleton debe respetar el layout final del componente para minimizar el layout shift.

```
Reglas:
- Skeleton: background #1e2330, animated shimmer rgba(255,255,255,0.05)
- Duracion de animacion: 1.5s ease-in-out, infinite
- Altura del skeleton = altura real del componente cuando hay datos
- No usar spinner centrado en el viewport excepto en carga inicial de pagina
```

### Error

Dos niveles de error:

**Error de componente** (falla solo una seccion):
- Icono de alerta pequeño + mensaje en la zona del componente.
- Texto: "No se pudieron cargar los datos" + boton "Reintentar".
- No bloquear el resto de la pantalla.

**Error de accion** (falla una operacion del usuario — sync, guardar, etc.):
- Toast en esquina inferior derecha (sistema Sonner ya integrado).
- `toast.error(mensaje, { description: codigo_error })`.
- Color: rojo semantico `#f87171`.

### Empty

El empty state es parte del producto, no un after-thought. Cada vista debe tener un empty state utilitario:

| Vista | Empty state message | CTA sugerido |
| --- | --- | --- |
| Lista de equipos | "No hay equipos registrados todavia." | Boton "Crear primer equipo" |
| Roster vacio | "Este equipo no tiene jugadores activos." | Boton "Añadir jugador" |
| Busqueda sin resultados | "No se encontraron jugadores con ese nombre." | Link "Buscar y sincronizar en pred.gg" |
| Player scouting sin datos | "Este jugador no tiene partidas sincronizadas." | Boton "Sincronizar ahora" |
| Heatmap sin datos suficientes | "Se necesitan al menos N partidas para mostrar este heatmap." | Indicador de N partidas actuales vs requeridas |
| Metricas sin muestra suficiente | Badge "Muestra insuficiente" con tooltip explicativo | — |

### Confianza insuficiente (estado especifico de metricas)

Cuando una metrica tiene menos partidas que el `min_sample_matches` definido en el catalogo:

- Mostrar el valor calculado en gris (`#64748b`) en lugar del color semantico.
- Anadir badge "Pocos datos" en ambar (`#f0b429`).
- Tooltip: "Este calculo se basa en N partidas. Se recomiendan al menos M para mayor fiabilidad."
- No ocultar el valor — el coach puede necesitar verlo igualmente, pero sabe que es orientativo.

---

## Sistema de iconos

### Iconos de rol (ya disponibles)

Archivos en `assets/icons/roles/`: `carry.png`, `jungle.png`, `midlane.png`, `offlane.png`, `support.png`.

Usar siempre en 20×20px en tablas y 24×24px en headers de perfil. No escalar por encima de 32px sin version vectorial.

### Iconos de objetivo

Se deben crear o definir para:

| Objetivo | Identificador | Color sugerido |
| --- | --- | --- |
| Fangtooth | `fangtooth` | Rojo `#ef4444` |
| Primal Fangtooth | `primal_fangtooth` | Rojo oscuro `#b91c1c` |
| Mini Prime | `mini_prime` | Violeta `#a78bfa` |
| Orb Prime | `orb_prime` | Violeta brillante `#7c3aed` |
| Buff de jungla | `jungle_buff` | Verde `#22c55e` |

Estos iconos pueden ser simples formas geometricas con el color semantico mientras no haya assets oficiales.

### Iconos de tipo de ward

| Ward | Identificador | Color |
| --- | --- | --- |
| Stealth Ward | `ward_stealth` | Azul `#3b82f6` |
| Oracle/Sentry | `ward_oracle` | Naranja `#f97316` |
| Sonar Drone | `ward_sonar` | Cian `#14b8a6` |
| Solstone Drone | `ward_solstone` | Violeta `#a78bfa` |

### Iconos de estado y accion

| Estado | Icono | Color |
| --- | --- | --- |
| Sync en progreso | Spinner 16px | Azul `#5b9cf6` |
| Sync completado | Check | Verde `#4ade80` |
| Sync fallido | X | Rojo `#f87171` |
| Dato privado / acceso restringido | Candado | Ambar `#f0b429` |
| Baja confianza estadistica | Triangulo alerta | Ambar `#f0b429` |
| RBAC: solo staff | Shield | Rojo `#f87171` a 60% |
| Perfil privado (pred.gg) | Ojo tachado | Gris `#64748b` |

---

## Patrones de interaccion

### Cuando usar cada patron de edicion

| Accion | Patron | Razon |
| --- | --- | --- |
| Crear equipo nuevo | Formulario inline (expandible en la misma pagina) | Flujo frecuente; no requiere contexto adicional |
| Editar equipo | Formulario inline en el panel de detalle | El coach ve los datos actuales mientras edita |
| Añadir jugador al roster | Busqueda inline dentro del panel de roster | Flujo rapido; el jugador ya esta en el sistema |
| Editar rol de jugador en roster | Dropdown inline en la fila del roster | Cambio de un campo; no justifica modal |
| Eliminar equipo | Confirmacion modal (destructivo) | Accion irreversible; requiere confirmacion explicita |
| Eliminar jugador del roster | Confirmacion inline (boton de confirmacion en la fila) | Soft-delete; reversible; modal es excesivo |
| Crear tag de review | Panel lateral (drawer) | Necesita timestamp + comentario + acceso; mas espacio |
| Ver detalle de metrica | Tooltip o expand-in-place | No interrumpe el flujo de analisis |
| Subir logo de equipo | Input de URL o upload inline dentro del formulario de equipo | Flujo natural dentro de la creacion/edicion |

### Confirmaciones

- Acciones destructivas irreversibles (eliminar equipo, eliminar jugador con historial): modal de confirmacion con texto descriptivo de consecuencias.
- Acciones reversibles (soft-delete, cambio de rol): confirmacion inline; no modal.
- Acciones de sync: feedback inmediato con estado de progreso visible (no bloquear la UI).

### Teclado y accesibilidad

- Todos los formularios deben ser navegables con Tab.
- Los dropdowns deben responder a teclas de flecha.
- Los modales deben atrapar el foco y cerrarse con Escape.
- Los botones de accion destructiva deben requerir confirmacion adicional (no pueden ejecutarse con un solo Enter).

---

## Diseno mobile — breakpoints

PrimeSight es una herramienta de trabajo. El movil tiene un caso de uso especifico: consultas rapidas entre partidas, en remplazo o en traslado. No intentar meter el dashboard completo en movil.

### Breakpoints definidos

| Nombre | Anchura | Layout |
| --- | --- | --- |
| Mobile | < 640px | Una columna; sidebar oculto (hamburger menu) |
| Tablet | 640px – 1024px | Sidebar colapsado (solo iconos); contenido en 1-2 columnas |
| Desktop | > 1024px | Sidebar completo + contenido en layout de 2-3 columnas |

### Vistas prioritarias en mobile

Estas vistas deben funcionar bien en mobile:

1. **Busqueda rapida de jugador** — nombre → perfil con KDA, winrate, herores top.
2. **Roster de equipo** — lista de jugadores con rol y rango.
3. **Scrim Report** — resumen de picks y metricas clave (solo lectura).
4. **Dashboard** — estado de API, parche actual, ultimo sync.

### Vistas que NO deben forzarse en mobile

- Heatmaps (requieren pantalla grande para ser legibles).
- Tablas de analisis con muchas columnas (colapsarlas o paginatarlas).
- Formularios de creacion compleja (mejor en desktop).

### Reglas de tabla en mobile

- Fijar la columna de nombre/jugador a la izquierda (sticky).
- Mostrar solo 3-4 columnas clave; el resto en expand/scroll horizontal.
- Usar chips en lugar de texto largo para rol, rango y estado.

---

## Visualizacion del draft

El draft es un modulo diferencial para scouting y preparacion de partido. Aunque es una feature de Fase 3 (segun el catalogo de indicadores), el patron visual debe definirse desde ahora para que los componentes de pool de heroes y comfort scores sean coherentes con el.

### Patron de display de picks y bans

```
[EQUIPO PROPIO]            [EQUIPO RIVAL]
Ban: [Hero] [Hero] [Hero]  Ban: [Hero] [Hero] [Hero]

Pick orden:
[Carry:  Avatar + Nombre]  [Carry:  Avatar + Nombre]
[Jungle: Avatar + Nombre]  [Jungle: Avatar + Nombre]
[Mid:    Avatar + Nombre]  [Mid:    Avatar + Nombre]
[Off:    Avatar + Nombre]  [Off:    Avatar + Nombre]
[Supp:   Avatar + Nombre]  [Supp:   Avatar + Nombre]
```

Cada pick muestra:
- Avatar del heroe (de `assets/heroes/<slug>.webp`).
- Nombre del heroe.
- Comfort score del jugador con ese heroe (badge de color: alto/medio/bajo).
- Si el heroe fue baneado contra ese jugador en historico (indicador discreto).

### Ban vulnerability display

En el perfil de un jugador rival, mostrar su pool de heroes con:
- Lista ordenada por partidas jugadas.
- Badge "Baneable" si el hero pool es estrecho (IND-032/033).
- Indicador de drop de rendimiento cuando un heroe clave es baneado.

### Damage balance visual

Para TEAM-024, mostrar el balance de composicion como una barra dividida:
`[Fisico ||||||||] [Magico ||||] [True ||] [Utility |]`
Con colores neutros (no rojo/verde) ya que el balance no es bueno o malo per se.

---

## Senales de RBAC desde el MVP

Aunque el sistema completo de roles y permisos es una feature de largo plazo, las senales visuales deben existir desde el MVP para que no haya que redisenar componentes posteriormente.

### Niveles de acceso

| Nivel | Identificador | Badge color |
| --- | --- | --- |
| Staff completo | `staff` | Sin badge (acceso total) |
| Coach / Analista | `coach` | Azul `#5b9cf6` |
| Jugador | `player` | Verde `#4ade80` |
| Solo lectura | `viewer` | Gris `#64748b` |

### Implementacion MVP

- Los datos marcados como "Staff privado" (IND-040, actitud de jugadores) deben tener un icono de candado visible en su card/fila.
- Los datos marcados como "Staff + jugador afectado" deben mostrar un icono de visibilidad restringida cuando se ven en contexto de equipo (visible para el jugador en su propio perfil, oculto para otros jugadores).
- En el MVP, la implementacion puede ser simplemente CSS/logica frontend sin backend RBAC completo, pero el componente visual debe estar listo.

---

## Indicadores de confianza en datos

Esta seccion define como comunicar al usuario la fiabilidad de cada metrica mostrada.

### Badge de confianza

Anadir un badge de confianza a cualquier metrica que tenga `min_sample_matches` definido en el catalogo:

| Estado | Condicion | Visual |
| --- | --- | --- |
| Alta confianza | Partidas >= min_sample_matches * 2 | Sin badge (color semantico normal) |
| Confianza media | Partidas >= min_sample_matches | Badge gris claro "N partidas" |
| Baja confianza | Partidas < min_sample_matches | Badge ambar "Pocos datos" + valor en gris |
| Sin datos | 0 partidas | Empty state (ver seccion estados) |

### Tooltip de confianza

Al hacer hover sobre el badge "Pocos datos":

> "Este calculo se basa en [N] partidas. El catalogo de indicadores recomienda al menos [M] para mayor fiabilidad. Los valores mostrados son orientativos."

### Metricas con dependencias no confirmadas

Para metricas con `data_dependency` que incluye `gold_timeline`, `draft_bans` o `item_timestamps`:

- Mostrar placeholder "Pendiente de datos" en lugar de empty state generico.
- Tooltip: "Este indicador requiere [tipo de dato] que aun no ha sido confirmado como disponible en la API de pred.gg. Se activara cuando se valide la fuente."

---

## Limitaciones conocidas de datos

Esta seccion documenta las limitaciones del sistema de datos confirmadas tras investigacion directa de la API de pred.gg (Mayo 2026).

---

### Resumen de disponibilidad de datos (verificado con API real)

| Dato | Estado | Notas |
| --- | --- | --- |
| `heroKills` {gameTime, location x/y/z, killerTeam, killedTeam, killerHero, killedHero} | ✅ CONFIRMADO | Requiere auth (Bearer token) |
| `objectiveKills` {gameTime, killedEntityType, killerTeam, killerPlayer, location} | ✅ CONFIRMADO | FANGTOOTH, PRIMAL_FANGTOOTH, ORB_PRIME, MINI_PRIME, buffs todos presentes |
| `structureDestructions` {gameTime, structureEntityType, destructionTeam, location} | ✅ CONFIRMADO | OUTER_TOWER, INNER_TOWER, INHIBITOR, CORE |
| `wardPlacements` {gameTime, type, location} | ✅ CONFIRMADO | 5 tipos: STEALTH, ORACLE, SENTRY, SONAR_DRONE, SOLSTONE_DRONE |
| `wardDestructions` {gameTime, type, location} | ✅ CONFIRMADO | Mismos campos que wardPlacements |
| `goldEarnedAtInterval` (oro acumulado por minuto) | ✅ CONFIRMADO | Array de N valores (1 por minuto de partida). TEAM-005/006/007 son viables. |
| `transactions` {gameTime, transactionType, itemData} | ✅ CONFIRMADO | BUY/SELL/UNDO timestamps exactos. IND-034 es viable. |
| `heroBans` {hero, team} | ✅ PARCIAL | Solo en partidas RANKED. Solo hero+team, SIN orden de ban ni secuencia de picks. |
| `matchPlayers` con rol y heroe | ✅ CONFIRMADO | Picks calculables como composicion. NO hay secuencia de draft. |
| Event stream auth | ⚠️ REQUIERE AUTH | heroBans, heroKills, etc. devuelven Forbidden sin Bearer token. Match basico sin auth. |

---

### 1. El event stream requiere autenticacion Bearer (pred.gg token)

Los campos avanzados del match (heroBans, heroKills, objectiveKills, wardPlacements, transactions) solo son accesibles con un Bearer token valido de pred.gg. Sin auth, estos campos devuelven `Forbidden`.

**Impacto en el sync worker:** El sync worker actual debe pasar el Bearer token del usuario al hacer las queries de partidas con event stream. Esto significa que la sincronizacion de event data solo puede ocurrir mientras el usuario tiene sesion activa en la aplicacion.

**Estrategia recomendada:** El sync de event stream se activa cuando el usuario esta logueado. El sync de stats basicos (aggregados de MatchPlayer sin event stream) puede hacerse con token limitado o en background.

### 2. Jugadores sin cuenta pred.gg (name = null)

En el event stream, muchos `killerPlayer` y `killedPlayer` devuelven `{name: null}`. Esto NO siempre indica perfil privado — puede significar que el jugador no tiene cuenta pred.gg vinculada (jugadores de consola, PC sin cuenta registrada).

**Impacto:** En una partida real de 25 minutos, de 10 jugadores: 8 nombres eran null, 2 visibles. Esto es frecuente y esperado.

**Lo que SI esta disponible:** El campo `player.id` (UUID) esta siempre presente aunque el nombre sea null. El heroe jugado, kills, deaths, gold y el event stream del jugador siguen siendo accesibles por UUID.

**Impacto en scouting:** Para scouting rival, si el jugador no tiene cuenta pred.gg vinculada, no podemos buscarle por nombre ni ver su historial directamente. Solo podemos trackear su UUID si aparece en partidas de jugadores que si trackemos.

**UI:** Badge discreto "Sin cuenta pred.gg" (distinto de "Perfil privado"). No tratar como error sino como estado normal de datos incompletos.

### 3. Perfiles privados en pred.gg (blockSearch, blockName)

Los campos `blockSearch`, `blockName` y `userPublic` controlan la visibilidad del perfil de un jugador que SI tiene cuenta. Un jugador con `blockSearch=true` no aparece en busquedas. Un jugador con `blockName=true` oculta su nombre publicamente.

**Impacto en scouting rival:** Si un rival tiene `blockSearch=true`, no podemos encontrarle por nombre. Los stats agregados (winrate, KDA) de su perfil pueden estar ocultos.

**UI:** Badge "Perfil privado" (icono de ojo tachado). No confundir con "Sin cuenta pred.gg".

### 4. Bans solo disponibles en RANKED, sin orden de draft

`heroBans` confirma que los bans existen en la API. Pero:
- Solo aparecen en partidas de modo RANKED (STANDARD y ARAM no tienen bans).
- El campo `heroBans` devuelve solo `{hero, team}` — NO hay `order`, `pickSlot` ni secuencia de picks.
- Los picks no tienen orden de seleccion; solo conocemos que heroe jugo cada jugador al final.

**Impacto en metricas de draft:** Podemos calcular:
- ✅ Composicion final (qué héroes jugo cada equipo)
- ✅ Balance de daño por composicion
- ✅ Que heroes se banean contra un equipo/jugador
- ❌ Secuencia de bans (ban 1, ban 2, ban 3...)
- ❌ Orden de picks (pick 1 = carry, pick 2 = jungle...)
- ❌ Counter-picks (saber que pick fue respuesta a cual)

Para analisis de draft avanzado con secuencia se necesitaria entrada manual o un sistema de tracking durante el draft en vivo.

### 5. Sincronizacion historica creciente (no limitada permanentemente)

A diferencia de un export puntual, PrimeSight almacena los datos en la base de datos local. Cada sync añade nuevas partidas al historial existente. Con el tiempo, el historico crece y las metricas de consistencia, comfort de heroe y tendencias mejoran su fiabilidad.

**Implicacion de UI:** Mostrar "N partidas analizadas" como dato dinamico que crece. Las alertas de "muestra insuficiente" deben desactivarse automaticamente conforme el historico crece. El min_sample_matches del catalogo es el umbral a partir del cual el badge de baja confianza desaparece.

### 6. Mezcla de modos de juego

El sync trae partidas de todos los modos (RANKED, STANDARD, ARAM). Para analisis competitivo los modos no son intercambiables.

**UI:**
- Filtro de modo en todas las vistas de analisis (RANKED / STANDARD / ARAM / todos).
- Por defecto en vistas de scouting: filtrar por RANKED.
- Badge de modo en cada partida del historial.
- Los bans (heroBans) solo existen en RANKED; el filtro de draft debe aplicarse solo a esas partidas.

### 7. El event stream no esta almacenado actualmente (Fase 2 prerequisito)

El sync worker actual guarda stats agregados por jugador (MatchPlayer totales). El event stream individual (HeroKill con X/Y/Z, WardPlacement por evento, Transactions por item) no se esta almacenando en la base de datos.

**Impacto:** Todas las metricas de Fase 2+ y todos los heatmaps requieren este event stream almacenado. Antes de implementar heatmaps o metricas temporales, el sync worker debe extenderse para:
1. Capturar y almacenar los eventos individuales por partida.
2. Pasar el Bearer token al hacer estas queries (ver punto 1).

**UI:** Hasta que el event stream este habilitado, las secciones de heatmap y metricas de Fase 2 deben mostrar un placeholder informativo: "Los heatmaps estaran disponibles cuando se active la sincronizacion de eventos de partida."

---

## Catalogo de indicadores — referencia

El catalogo completo de indicadores se encuentra en `docs/primesight_indicators_catalog.csv` con las columnas:

| Columna | Descripcion |
| --- | --- |
| `indicator_id` | Identificador unico (IND-XXX, TEAM-XXX, HM-XXX, REV-XXX) |
| `category` | individual_metric / team_metric / heatmap_visualization / review_marker |
| `level` | player / team / map_event / vod_review |
| `implementation_phase` | 1-4 segun el plan de fases del documento tecnico |
| `data_dependency` | basic_stats / event_stream / gold_timeline / draft_bans / item_timestamps / zone_definitions / manual |
| `min_sample_matches` | Partidas minimas para fiabilidad estadistica |
| `recommended_access` | Quien puede ver este indicador (Staff / Staff + equipo / Staff + jugador afectado / Staff privado) |
| `priority` | Alta / Media / Muy alta |

### Plan de fases de implementacion

| Fase | Nombre | Contenido principal | Dependencia clave |
| --- | --- | --- | --- |
| 1 | Base API | Stats individuales, objective control, heatmaps basicos | basic_stats + event_stream |
| 2 | Macro y objetivos | Ventanas pre-objetivo, gold diff, death scores, heatmaps avanzados | event_stream completo + zone_definitions |
| 3 | Draft y scouting | Hero pool, comfort scores, bans, threat index, scouting rival | draft_bans confirmado |
| 4 | Review manual | Tags de VOD review, acciones correctivas, plan de entrenamiento | Manual (staff) |

**Reglas transversales del catalogo:**
1. No comparar jugadores de roles distintos con la misma metrica sin normalizacion por rol.
2. No asignar culpa automatica por una muerte critica; generar alerta y pedir review.
3. Separar ranked, scrim, oficial y torneo en todos los filtros.
4. Guardar version del calculo y filtros usados para auditabilidad.
5. Para scouting rival, exigir minimo de partidas antes de mostrar conclusiones fuertes.
6. Los heatmaps deben combinar coordenadas X/Y con zonas tacticas nombradas.

