# Player Coach: alcance P0–P3

Este documento recoge la evolución de RiftLine hacia un coach educativo para SoloQ sin eliminar las herramientas de equipo ya existentes.

## Principios de producto

- Enseñar criterios transferibles, no recetas rígidas de objetos o decisiones.
- Separar hechos medidos, inferencias y aspectos que requieren revisar el replay.
- Mostrar primero una acción útil y permitir ampliar la evidencia bajo demanda.
- Evaluar al jugador desde su rol; el contexto de equipo sigue disponible como información avanzada.
- Conservar los módulos de analista y gestión para el futuro coaching de equipos.

## P0 — Confianza en el dato

- Cada partida muestra su parche real y el encabezado distingue el catálogo global.
- El análisis de build declara si utiliza el catálogo exacto o el catálogo anterior más próximo.
- Las valoraciones educativas son cualitativas; las métricas observadas conservan sus valores numéricos.
- Los textos generados eliminan marcadores internos no resueltos.
- Cuando una causa no puede demostrarse, el coach lo indica y deriva la comprobación al replay.

## P1 — Experiencia centrada en el jugador

- El detalle abre por defecto en `Coach` y organiza el análisis en Resumen, Momentos clave, Build y loadout, Habilidades, Línea y economía, Combate y posición, y Objetivos y visión.
- El propio jugador queda destacado en Marcador y Estadísticas.
- Mis partidas incorpora filtros, métricas por minuto, parche y paginación.
- La cronología separa objetivos mayores de recursos menores, admite foco desde un momento de aprendizaje y permite mostrar solo eventos propios atribuibles.
- El informe semanal resume los patrones de build y mantiene el detalle adicional plegado.

## P2 — Aprendizaje deliberado

- Los Momentos clave enlazan con la ventana correspondiente de la cronología.
- El jugador puede registrar la conclusión del replay como error confirmado, buena decisión o caso no concluyente, con una nota opcional.
- Un momento puede convertirse en un ciclo de práctica de cinco partidas.
- Mi progreso muestra el ciclo activo, su consigna, avance automático y acciones para completarlo o archivarlo.
- El informe semanal detecta patrones repetidos de build, loadout y champion pool sobre una muestra temporal.

## P3 — Escalado futuro a equipos

- Los usuarios que sean jugadores y miembros de un equipo pueden elegir el espacio Jugador o Equipo/Analista.
- La navegación personal permanece reducida a progreso, coach semanal, partidas y perfil.
- El contexto colectivo y las evidencias densas siguen disponibles, pero plegados dentro del análisis personal.
- No se han eliminado modelos, rutas ni pantallas de roster, scouting, scrims, VOD, review, tablero, playbook o administración.

## Límites actuales que el producto debe declarar

- Los eventos no reconstruyen movimiento continuo, intención, comunicación ni visión exacta disponible en cada instante.
- El orden de habilidades no puede evaluarse cuando la fuente no lo proporciona.
- Las relaciones temporales entre ward, muerte y objetivo no prueban causalidad.
- Un catálogo anterior permite explicar conceptos, pero reduce la confianza sobre valores exactos del parche.
- El coach IA debe basarse en evidencias estructuradas y nunca completar huecos inventando jugadas.

## Siguiente fase recomendada

Validar durante varias semanas los ciclos de cinco partidas con un único usuario real. Las conclusiones guardadas del replay deben utilizarse después para medir qué consejos fueron correctos, cuáles eran ruido y qué patrones producen mejora sostenida por rol y héroe.
