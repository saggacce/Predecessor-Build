# Integración pred.gg para el coach personal

**Actualizado:** 2026-08-27

Este documento describe la base de datos y las capacidades de pred.gg que RiftLine usa para convertir el historial de un jugador en recomendaciones de mejora. El diseño mantiene los módulos de equipo existentes, pero prioriza el uso personal y evita que una función opcional bloquee el informe completo.

## Capacidades implementadas

### 1. OAuth y permisos

RiftLine solicita `offline_access`, `profile`, `player:read:interval`, `hero_leaderboard:read` y `matchup_statistic:read`. El servidor consulta `currentAuth.scope`, conserva los permisos realmente concedidos y muestra por separado los que faltan.

La ausencia de un permiso avanzado no invalida la conexión: las comparativas personales siguen disponibles y solo se bloquea el módulo dependiente. Una cuenta que se conectó antes de ampliar los permisos debe volver a autorizar pred.gg una vez.

### 2. Telemetría de partidas

Además de KDA, oro, daño y visión, se sincronizan:

- daño recibido físico, mágico y verdadero, total y procedente de héroes;
- curación por habilidades, objetos y crest;
- escudos recibidos y daño mitigado;
- súbditos de línea y monstruos de jungla propia/enemiga;
- orden de habilidades cuando el permiso lo permite;
- cambio de rating y rango de la partida;
- causa y hora de finalización y bloqueo temporal de spoilers.

Los campos protegidos se solicitan únicamente con token. Si pred.gg no los devuelve, se almacenan como desconocidos, no como cero.

### 3. Loadout: augmento, Eternal y bendiciones

El loadout actual tiene cuatro posiciones: augmento de héroe, Eternal y dos bendiciones menores. Se conserva el orden, nombre, icono, descripción, categoría y relación entre Eternal y bendiciones. La interfaz ya no presenta el conjunto como tres “augments”.

### 4. Champion pool y contexto personal

El informe puede filtrarse por ventana temporal, modo, rol y héroe. Sobre las partidas sincronizadas calcula rendimiento por héroe, rivales más difíciles, rivales dominados y mejores sinergias. Las conclusiones con menos de dos partidas se mantienen fuera de los destacados para reducir falsos patrones.

### 5. Catálogos versionados

Items, perks, Eternals, bendiciones y categorías se guardan por versión del juego. Para cada item se conservan estadísticas, efectos estructurados, precios, árbol de construcción e incompatibilidades. Para cada perk se conservan posición, texto, iconos, héroe, categoría y relaciones con bendiciones menores.

El catálogo se sincroniza al actualizar versiones y también mediante `POST /admin/sync-game-catalog`. Sin indicar versión, esta ruta rellena el parche actual y hasta 16 parches recientes que aparecen en el último año del historial local, evitando mezclar datos actuales con partidas antiguas sin intentar reconstruir innecesariamente todo el archivo histórico.

### 6. Análisis contextual de build

El análisis de una partida cruza la build usada con la composición real de daño recibida, curación, escudos y mitigación del rival. Puede detectar falta de defensa física o mágica, anti-curación, anti-escudo, penetración contra tanques e items incompatibles. Las sugerencias se limitan a items legendarios visibles del parche de la partida.

Este módulo explica evidencia y recomendación; no afirma que exista una única build correcta ni sustituye el contexto de ejecución de la partida. Si una partida referencia una compilación interna sin items, se usa el catálogo de contenido más cercano y anterior, manteniendo la coherencia del parche.

### 7. Benchmarks y agregados propios

Los permisos poblacionales de pred.gg no están concedidos a la aplicación. RiftLine no intenta sortear esa restricción. En su lugar mantiene tres agregados propios sobre las partidas almacenadas:

- builds por parche, modo, rol, héroe e inventario final;
- matchups por parche, modo, rol y pareja de héroes enfrentados;
- intervalos semanales personales por modo, rol y héroe.

Cada resultado identifica `riftline_local` como fuente, publica el tamaño de muestra y clasifica la confianza como inicial, media o alta. Las estadísticas restringidas de pred.gg permanecen como capacidad opcional y nunca se presentan como si fueran locales.

### 8. Contrato educativo del coach

El resumen de partida limita la carga cognitiva a un foco principal, un máximo de dos focos secundarios y una conducta que conviene conservar. Cada observación desarrollada separa:

- evidencia observada;
- interpretación y relevancia;
- práctica para las siguientes partidas;
- excepción para evitar convertirla en una regla automática;
- ejemplos transferibles a otros héroes o situaciones;
- confianza y limitación de la fuente.

La pestaña `Analysis` organiza el contenido en Resumen, Build y loadout, Habilidades, Línea y economía, Combate y posición, y Objetivos y visión. Las inferencias posicionales se limitan a las coordenadas de muertes, objetivos, estructuras y wards; sin VOD no se afirma conocer el movimiento continuo.

### 9. Momentos de aprendizaje y replay guiado

El análisis individual selecciona un máximo de tres ventanas de replay por partida para evitar sobrecarga. Los candidatos actuales incluyen muertes antes de objetivos, cambios adversos relevantes en la diferencia de oro, una primera muerte que conviene investigar y preparación positiva de visión.

Cada momento separa un hecho comprobado de una hipótesis que el jugador debe validar. Incluye el intervalo recomendado del replay, preguntas concretas, un principio transferible, confianza y limitación. La aplicación no presenta estos candidatos como errores confirmados ni atribuye causalidad individual a un cambio colectivo de oro.

La primera versión se calcula bajo demanda y no persiste la respuesta del jugador. La evolución prevista es guardar la causa confirmada con ámbito personal o de equipo y vincularla a un objetivo de entrenamiento, reutilizando el mismo motor en SoloQ y sesiones de review colectivo.

## Degradación y fiabilidad

- Cada capacidad informa su estado y motivo de indisponibilidad.
- La falta de OAuth no impide usar el análisis local de partidas ya sincronizadas.
- Los filtros de benchmark personal y población son idénticos para evitar comparaciones engañosas.
- Los catálogos se vinculan al parche de la partida para no recomendar datos de otra versión.
- Los datos ausentes permanecen como `null`; no se convierten en rendimiento cero.

## Rutas de aplicación

| Ruta | Resultado |
|---|---|
| `GET /admin/api-status` | Estado OAuth, permisos solicitados, concedidos y ausentes |
| `POST /admin/sync-game-catalog` | Sincronización del catálogo del parche actual |
| `GET /players/:id/champion-pool-context` | Pool, matchups y sinergias personales con filtros |
| `GET /players/:id/benchmarks` | Comparación poblacional y capacidades avanzadas |
| `GET /players/:id/coach-aggregates` | Agregados locales de build, matchup e intervalos personales |
| `GET /matches/:id/build-analysis/:matchPlayerId` | Diagnóstico contextual de la build de una partida |
| `GET /matches/live/:predggUuid/build-analysis` | El mismo diagnóstico para la partida abierta desde “Mis partidas” |
| `GET /matches/:id/coach-analysis/:matchPlayerId` | Resumen educativo y apartados personales de una partida |
| `GET /matches/live/:predggUuid/coach-analysis` | Análisis personal de la partida abierta desde “Mis partidas” |
| `POST /admin/refresh-coach-aggregates` | Reconstrucción de los tres agregados locales |

## Siguiente evolución recomendada

El ciclo actual guarda un foco semanal, mide automáticamente las cinco partidas posteriores contra las cinco anteriores y cierra el objetivo como conseguido o pendiente de ajuste. La siguiente evolución debe validar la calidad pedagógica con sesiones de usuario y, después, reutilizar el mismo contrato para coaching coordinado de equipo sin alterar las conclusiones específicas de SoloQ.
