# Academia personal y ruta hacia el coach adaptativo

## Decisión de producto

RiftLine se desarrolla primero como herramienta personal para aprender SoloQ en Predecessor. Esto no elimina los módulos de equipo: conserva datos, permisos y flujos separados para que el coaching coordinado pueda evolucionar después sin mezclar sus conclusiones con las del jugador individual.

El nivel de Academia no es MMR ni rango competitivo. Representa conocimiento demostrado y se calcula por competencia con varias evidencias. Un test inicial sólo produce una estimación provisional.

## Estado de los seis bloques

1. **Enciclopedia trazable**: catálogo unificado de fundamentos revisados, héroes, habilidades, estadísticas base, objetos, Augmentos y categorías de Eternos. Los datos variables conservan el parche y la fuente. La pantalla de cobertura muestra huecos en lugar de fingir conocimiento completo.
2. **Perfil pedagógico**: cinco niveles y siete competencias independientes. Cada una guarda dominio, confianza, número de evidencias y próxima revisión.
3. **Diagnóstico y práctica adaptativa**: banco inicial de situaciones, rúbrica determinista, respuestas `adecuada`, `defendible`, `arriesgada` o `no sé`, misiones por competencia y ciclos compatibles con los ya existentes. Una respuesta aislada no promociona al jugador.
4. **Post-partida educativo**: el análisis conserva una única prioridad, aspectos positivos, evidencia, inferencia, limitaciones y preguntas. Ahora puede añadir un checkpoint acorde al perfil sin alterar los análisis de equipo.
5. **Replay personal**: sesiones privadas separadas de los VOD de equipo, marcadores alineados con el tiempo de partida y conclusiones del jugador. Los momentos del análisis pueden convertirse en una revisión sin afirmar causas que la API no demuestra.
6. **Entrenamiento local**: prototipo de permiso y captura de pantalla. Ranked y sus alias están bloqueados en servidor. Elegir manualmente un modo nunca activa consejos; sólo una detección automática de alta confianza de una lista explícita podría hacerlo. No hay lectura de memoria, inyección, automatización ni funcionalidad de equipo.

La especificación cerrada del primer overlay, sus detectores y el contrato de evidencia con Academia están en [`live_training_overlay_mvp.md`](./live_training_overlay_mvp.md). El servidor exige dos fuentes automáticas coincidentes para habilitar un modo permitido y bloquea de forma irreversible una sesión cuando una señal fiable identifica Ranked.

## Reglas pedagógicas

- Enseñar principio, evidencia, excepción y transferencia; evitar recetas rígidas.
- Mostrar una prioridad principal y como máximo dos secundarias antes del detalle opcional.
- Adaptar el vocabulario y la profundidad al nivel demostrado.
- Usar partidas y revisiones como evidencia; no convertir el número de partidas en aprendizaje automático.
- Separar siempre hecho observado, inferencia razonable y aspecto que requiere replay.
- No atribuir pathing, intención, comunicación, calidad exacta de un ward o posicionamiento continuo sin vídeo.

## Límites reales pendientes

- La enciclopedia todavía necesita revisión editorial de interacciones, matchups y excepciones por parche. Tener descripciones no equivale a conocimiento experto validado.
- El prototipo local no incluye todavía OCR/visión fiable ni latencia probada. Hasta disponer de detección automática robusta permanece sin consejos.
- Antes de distribuir cualquier overlay o entrenamiento en vivo se necesita confirmación explícita de Omeda sobre políticas y modos permitidos.
- La evaluación automática de misiones observables debe ampliarse con métricas agregadas propias; las misiones reflexivas requieren una conclusión del jugador o replay.
- El vídeo local no se sube automáticamente. Cualquier almacenamiento futuro necesitará consentimiento, retención, cifrado y borrado claros.

## Criterio para considerar el coach útil

No basta con generar texto plausible. Una recomendación debe poder explicar qué dato la activó, qué conocimiento versionado utilizó, cuánta confianza tiene, qué alternativa era defendible y qué tendría que mirar el jugador para confirmar la causa. Si falta una de esas piezas, RiftLine debe reducir la afirmación o declarar la limitación.
