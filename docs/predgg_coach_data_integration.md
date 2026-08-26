# Integración pred.gg para el coach personal

**Actualizado:** 2026-08-26

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

### 7. Benchmarks y especialistas

Para un héroe, rol y modo se comparan win rate, KDA, daño/minuto, oro/minuto, CS/minuto y visión con la población de pred.gg. Cuando están autorizados se añaden especialistas del héroe y matchups globales. La distribución de rating se intenta por separado porque pred.gg puede denegarla incluso con un token válido.

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
| `GET /matches/:id/build-analysis/:matchPlayerId` | Diagnóstico contextual de la build de una partida |

## Siguiente evolución recomendada

La siguiente iteración debe medir si las recomendaciones producen cambios: guardar un foco semanal, comprobarlo en las siguientes partidas y mostrar progreso. Antes de ampliar a gestión de equipos, conviene validar con suficientes partidas personales que el coach distingue señal estable de una muestra pequeña.
