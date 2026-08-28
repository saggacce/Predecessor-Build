# Arquitectura del coach adaptativo de RiftLine

## Decisión de producto

RiftLine no intentará entrenar un modelo fundacional para que memorice Predecessor. El coach se construye como un sistema compuesto:

1. conocimiento revisado y versionado;
2. evidencias deterministas de la partida;
3. perfil pedagógico del jugador;
4. recuperación del contexto relevante;
5. un LLM que explica y conversa sin inventar datos;
6. evaluaciones automáticas y revisión humana para medir calidad.

El modelo de lenguaje es la capa de comunicación, no la fuente de verdad.

## Fuentes de conocimiento

### Fundamentos MOBA estables

Currículo mantenido por RiftLine: economía, experiencia, tempo, oleadas, visión, objetivos, combate, funciones por rol, builds, adaptación, champion pool y revisión de replay.

Cada concepto debe incluir:

- definición sencilla;
- señales para reconocerlo;
- decisión que pretende mejorar;
- ejemplos positivos y negativos;
- excepciones;
- nivel mínimo en el que se enseña;
- competencias relacionadas;
- preguntas y misiones asociadas;
- fuentes y fecha de revisión.

### Conocimiento versionado de Predecessor

- héroes, roles, clases, habilidades y estadísticas;
- objetos, componentes, precio, estadísticas, efectos y relaciones de build;
- Augmentos, Eternos y bendiciones;
- parche de la partida y parche del catálogo utilizado;
- cambios de balance y reglas del mapa cuando exista una fuente mantenible.

Los valores dependientes del parche nunca deben guardarse como conocimiento permanente dentro del prompt.

### Evidencias personales

Marcador, build, loadout, orden de compra, orden de habilidades, intervalos de oro, kills, muertes, objetivos, estructuras y wards. Toda conclusión debe declarar si es:

- hecho observado;
- inferencia razonable;
- hipótesis que requiere replay;
- desconocido con los datos disponibles.

## Contrato de razonamiento

- Las referencias `E` son evidencias de partidas y sostienen diagnósticos personales.
- Las referencias `K` son conocimiento del juego y sostienen explicaciones educativas.
- Una referencia `K` no demuestra que un evento sucediera en la partida.
- Una correlación temporal no se presenta como causa.
- Primero se enseña el criterio, después se propone una acción.
- Las recomendaciones incluyen al menos una excepción relevante.
- El vocabulario y la cantidad de información se adaptan al perfil pedagógico.
- Cuando falta información, el coach dirige al minuto del replay y explica qué observar.

## Perfil pedagógico multidimensional

El nivel global resume, pero no sustituye, las competencias:

| Competencia | Ejemplos de evidencias |
|---|---|
| Fundamentos MOBA | diagnóstico inicial, respuestas situacionales |
| Conocimiento del rol | decisiones específicas de Support, Carry, Jungla, Midlane u Offlane |
| Macro | objetivos, tempo, oleadas, rotaciones y estado del mapa |
| Micro conceptual | selección de objetivo, uso de recursos y ventanas de habilidad; la ejecución real requiere replay |
| Builds y loadout | adaptación, orden de compra, Eternal, Augmentos y bendiciones |
| Champion pool | dominio funcional, alternativa y cobertura de necesidades del rol |
| Revisión y autonomía | conclusiones de replay y capacidad de explicar decisiones |

Niveles educativos propuestos: Iniciación, Fundamentos, Consistencia, Adaptación y Dominio. El diagnóstico inicial asigna un nivel provisional. Dominio exige evidencia sostenida en partidas y revisiones, no sólo un cuestionario.

## Ciclo adaptativo

1. El sistema detecta una carencia con una confianza explícita.
2. Formula una pregunta breve antes de mostrar la respuesta cuando exista suficiente contexto.
3. Explica la opción adecuada, las alternativas defendibles y por qué.
4. Crea una misión principal para tres a cinco partidas y, como máximo, una secundaria opcional.
5. Mide sólo comportamientos observables y genera ventanas de replay para lo no observable.
6. Solicita una conclusión breve del jugador.
7. Repite el concepto en otro contexto para comprobar transferencia.
8. Ejecuta una prueba de ascenso mixta: conocimiento, aplicación y reflexión.
9. Actualiza cada competencia con evidencia y confianza; una mala partida aislada no provoca descenso.

## Diseño de preguntas

Las preguntas no son trivia. Deben presentar el contexto necesario para decidir y aceptar `No estoy seguro` como respuesta válida. Tipos:

- reconocer una amenaza o condición de victoria;
- elegir entre varias funciones de una compra;
- ordenar prioridades antes de un objetivo;
- identificar qué revisar en el replay;
- explicar una adaptación por rol;
- transferir un concepto a héroes o composiciones diferentes.

Las respuestas pueden clasificarse como adecuada, defendible, arriesgada o no evaluable. En decisiones contextuales no se fuerza una falsa única respuesta correcta.

## Qué hace la IA y qué no

La IA puede:

- seleccionar y explicar conocimiento recuperado;
- adaptar lenguaje, ejemplos y profundidad;
- relacionar evidencias compatibles;
- formular preguntas desde plantillas y rúbricas;
- resumir una misión y conversar sobre ella.

La IA no debe:

- inventar habilidades, eventos o causas;
- declarar correcto un pathing que no puede observar;
- evaluar mecánicas a partir del marcador;
- decidir por sí sola la respuesta correcta de una pregunta ambigua;
- modificar el nivel sin evidencias y reglas de progresión;
- usar datos de otro parche sin advertirlo.

## Evaluación antes de ajuste fino

Antes de considerar fine-tuning se necesita un conjunto de evaluación versionado con situaciones revisadas. Cada caso debe comprobar:

- exactitud sobre héroes, habilidades, objetos y parche;
- apoyo de cada afirmación personal en una evidencia `E`;
- apoyo de cada explicación del juego en una referencia `K`;
- reconocimiento de datos ausentes;
- ausencia de causalidad inventada;
- utilidad y carga cognitiva adecuadas al nivel;
- calidad de la pregunta y de su rúbrica;
- coherencia entre explicación, misión y criterio de ascenso.

El feedback libre de usuarios no se convierte automáticamente en datos de entrenamiento. Primero debe revisarse, corregirse, anonimizarse y etiquetarse. Sólo se valorará fine-tuning cuando exista un volumen suficiente de respuestas excelentes y errores repetitivos que no se resuelvan mediante recuperación, reglas o prompt.

## Entregas

### P0 — Base de conocimiento trazable

- [x] Separar evidencias de partida y conocimiento del juego en el coach IA.
- [x] Recuperar fundamentos MOBA revisados según pregunta y rol.
- [x] Recuperar héroes, objetos y loadouts desde el catálogo sincronizado.
- [x] Mostrar las fuentes de conocimiento utilizadas y su parche en la conversación.
- [ ] Crear pruebas doradas iniciales para respuestas sobre build, rol, objetivos y límites de datos.
- [ ] Añadir estado de frescura y cobertura del conocimiento en administración.

### P1 — Perfil y diagnóstico

- [ ] Modelar competencias, nivel provisional, confianza e historial de evidencias.
- [ ] Diseñar banco inicial de preguntas situacionales revisadas.
- [ ] Crear diagnóstico adaptativo de diez preguntas.
- [ ] Añadir modo pedagógico y profundidad de explicación por nivel.

### P2 — Preguntas y misiones adaptativas

- [ ] Insertar una pregunta contextual opcional en el análisis de partida.
- [ ] Guardar respuesta, explicación mostrada, rúbrica y evidencia utilizada.
- [ ] Proponer misiones desde carencias demostradas y medirlas en varias partidas.
- [ ] Usar replay y reflexión para decisiones no observables.
- [ ] Aplicar repetición espaciada y comprobar transferencia.

### P3 — Ascensos y calidad del coach

- [ ] Crear pruebas de ascenso mixtas por nivel y rol.
- [ ] Impedir que ganar/perder o una única métrica determinen el ascenso.
- [ ] Construir panel de calidad: aciertos, correcciones, incertidumbre y abandono.
- [ ] Crear dataset revisado de conversación y valorar fine-tuning sólo con evidencia suficiente.
- [ ] Reutilizar competencias y misiones en un contexto de equipo separado de SoloQ.

