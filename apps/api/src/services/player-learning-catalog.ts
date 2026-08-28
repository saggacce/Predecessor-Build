import { PLACEMENT_QUESTIONS_V3 } from './player-placement-catalog.js';

export const LEARNING_LEVELS = [
  { level: 1, key: 'INITIATION', label: 'Iniciación', description: 'Reconoce las reglas, recursos y funciones básicas sin vocabulario innecesario.' },
  { level: 2, key: 'FOUNDATIONS', label: 'Fundamentos', description: 'Toma decisiones básicas con una intención y comprende sus consecuencias.' },
  { level: 3, key: 'CONSISTENCY', label: 'Consistencia', description: 'Repite buenas decisiones durante varias partidas y reconoce patrones propios.' },
  { level: 4, key: 'ADAPTATION', label: 'Adaptación', description: 'Cambia prioridades, build y plan según composición, parche y estado de partida.' },
  { level: 5, key: 'MASTERY', label: 'Dominio', description: 'Razona excepciones, costes de oportunidad y decisiones coordinadas complejas.' },
] as const;

export const COMPETENCIES = [
  { key: 'moba_fundamentals', label: 'Fundamentos MOBA', description: 'Oro, experiencia, mapa, condiciones de victoria y lenguaje esencial.' },
  { key: 'role_knowledge', label: 'Conocimiento del rol', description: 'Responsabilidades y prioridades específicas de la posición jugada.' },
  { key: 'macro', label: 'Macro y objetivos', description: 'Tempo, oleadas, objetivos, información y decisiones sobre el mapa.' },
  { key: 'micro_concepts', label: 'Micro conceptual', description: 'Amenazas, alcance, recursos, selección de objetivo y rutas de salida.' },
  { key: 'builds', label: 'Build y loadout', description: 'Núcleo, adaptación, orden de compra, Augmentos, Eternos y bendiciones.' },
  { key: 'champion_pool', label: 'Champion pool', description: 'Héroe principal, alternativa funcional y cobertura de necesidades del rol.' },
  { key: 'review_autonomy', label: 'Revisión y autonomía', description: 'Capacidad de investigar un replay y formular una conclusión transferible.' },
] as const;

export type CompetencyKey = typeof COMPETENCIES[number]['key'];
export type QuestionEvaluation = 'ADEQUATE' | 'DEFENSIBLE' | 'RISKY' | 'UNKNOWN';

export interface LearningQuestionOption {
  id: string;
  text: string;
  evaluation: QuestionEvaluation;
  score: number;
  feedback: string;
}

export interface LearningQuestion {
  key: string;
  competencyKey: CompetencyKey;
  level: number;
  roles?: string[];
  prompt: string;
  context: string;
  options: LearningQuestionOption[];
  principle: string;
  knowledgeKeys: string[];
}

const unknown = (feedback: string): LearningQuestionOption => ({
  id: 'not_sure', text: 'No estoy seguro todavía', evaluation: 'UNKNOWN', score: 0, feedback,
});

export const LEGACY_PLACEMENT_QUESTIONS_V2: LearningQuestion[] = [
  {
    key: 'placement-v2-gold-conversion', competencyKey: 'moba_fundamentals', level: 1,
    prompt: 'Tienes 1.450 de oro, la oleada está empujada y no hay un objetivo próximo. ¿Qué decisión aporta más valor?',
    context: 'Puedes volver a base ahora y regresar antes de que la siguiente oleada importante llegue a tu torre.',
    options: [
      { id: 'stay_pressure', text: 'Quedarme hasta que el rival me obligue a volver para no ceder presión', evaluation: 'RISKY', score: 0.2, feedback: 'Mantener presión puede ser útil, pero aquí renuncia a una ventana segura y expone oro que todavía no aporta estadísticas.' },
      { id: 'buy', text: 'Volver, completar una compra útil y regresar antes de perder recursos', evaluation: 'ADEQUATE', score: 1, feedback: 'Esta ventana convierte el oro en poder sin regalar una oleada relevante. Si hubiera un objetivo o una jugada inmediata, habría que comparar ese coste antes de volver.' },
      { id: 'rotate_unspent', text: 'Rotar primero con el oro guardado porque la superioridad numérica basta', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'Una superioridad clara puede justificar retrasar la compra, pero el contexto no ofrece una jugada inmediata que compense llegar con menos poder efectivo.' },
      unknown('Esta duda será el primer concepto que trabajará el coach.'),
    ],
    principle: 'El oro acumulado se convierte en poder al comprar; el momento de volver a base también tiene un coste.', knowledgeKeys: ['economy'],
  },
  {
    key: 'placement-v2-objective-setup', competencyKey: 'macro', level: 2,
    prompt: 'Faltan 50 segundos para Fangtooth y tienes oro para una compra importante. ¿Qué plan seguirías?',
    context: 'La oleada cercana puede resolverse a tiempo y tu equipo está en condiciones de disputar el objetivo.',
    options: [
      { id: 'extra_wave', text: 'Tomar otra oleada y caminar directo al objetivo sin pasar por base', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'Puede funcionar si esa oleada crea una ventaja decisiva, pero aquí desaprovecha una compra disponible antes de una pelea previsible.' },
      { id: 'prepare', text: 'Comprar ahora, reagruparme y obtener información en los accesos', evaluation: 'ADEQUATE', score: 1, feedback: 'El plan usa la ventana completa: convierte el oro, permite llegar juntos y crea información antes de decidir si iniciar, cebar o ceder.' },
      { id: 'hold_pit', text: 'Entrar ya en la zona y esperar oculto hasta que aparezca Fangtooth', evaluation: 'RISKY', score: 0.2, feedback: 'Ocupar pronto puede tener valor, pero hacerlo sin comprar ni resolver la oleada facilita que el rival te encierre o gane recursos gratis.' },
      unknown('El coach explicará las cuatro piezas de una preparación de objetivo.'),
    ],
    principle: 'Los objetivos se preparan antes de aparecer.', knowledgeKeys: ['objectives', 'tempo'],
  },
  {
    key: 'placement-v2-vision-purpose', competencyKey: 'macro', level: 2,
    prompt: 'Tu equipo acaba de empujar y quiere jugar alrededor de la jungla derecha. ¿Dónde aporta más un ward?',
    context: 'Conoces una ruta probable del rival y tus aliados están cerca para reaccionar a la información.',
    options: [
      { id: 'deep', text: 'En el campamento más profundo, aunque tenga que entrar sin compañía', evaluation: 'RISKY', score: 0.15, feedback: 'La visión profunda puede ser valiosa, pero entrar solo convierte una buena ubicación teórica en un riesgo innecesario.' },
      { id: 'save_later', text: 'Lo guardo para colocarlo cuando la pelea ya haya empezado', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Un ward durante la pelea puede revelar una zona concreta, pero llega tarde para preparar rutas y decidir si aceptar el combate.' },
      { id: 'decision', text: 'En la ruta probable, antes de avanzar y mientras el equipo puede responder', evaluation: 'ADEQUATE', score: 1, feedback: 'El ward llega a tiempo, cubre una ruta relevante y su información puede cambiar la decisión del equipo. Otra ruta sería mejor si cambiara el objetivo o la presión de líneas.' },
      unknown('La misión inicial de visión se centrará en relacionar cada ward con una decisión.'),
    ],
    principle: 'Un ward vale por la decisión que habilita.', knowledgeKeys: ['vision'],
  },
  {
    key: 'placement-v2-build-function', competencyKey: 'builds', level: 2,
    prompt: 'Has completado la primera pieza de tu núcleo. ¿Cómo decides las siguientes compras?',
    context: 'Tu héroe aún necesita un pico principal, pero un rival concreto está condicionando las peleas.',
    options: [
      { id: 'counter_all', text: 'Sustituir el resto del núcleo por respuestas contra cada enemigo', evaluation: 'RISKY', score: 0.25, feedback: 'Responder a todo suele diluir la función propia del héroe. Una amenaza prioritaria no convierte cada ranura en un objeto defensivo o de counter.' },
      { id: 'core_adapt', text: 'Mantener el siguiente pico y adaptar una ranura a la amenaza prioritaria', evaluation: 'ADEQUATE', score: 1, feedback: 'Equilibra identidad y contexto. Si la amenaza impide por completo cumplir tu función, la adaptación puede adelantarse; si todavía no es relevante, puede esperar.' },
      { id: 'fixed', text: 'Completar el orden recomendado sin revisar quién decide las peleas', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Una build base ofrece coherencia, pero seguirla sin revisar el estado real pierde oportunidades de adaptación y puede llegar tarde a la amenaza.' },
      unknown('El coach separará núcleo, adaptación y coste de oportunidad.'),
    ],
    principle: 'Una build combina identidad del héroe y respuesta contextual.', knowledgeKeys: ['build_adaptation'],
  },
  {
    key: 'placement-v2-antiheal', competencyKey: 'builds', level: 2,
    prompt: 'El rival recupera mucha vida en peleas largas, pero comprar anti-curación retrasa tu siguiente pico. ¿Cuándo la priorizas?',
    context: 'Tu decisión debe considerar cuánto cambia la pelea y si tú puedes mantener aplicado el efecto.',
    options: [
      { id: 'relevant_repeatable', text: 'Antes de la pelea clave, si la curación cambia el resultado y puedo aplicarla', evaluation: 'ADEQUATE', score: 1, feedback: 'El valor depende de tres cosas: impacto real de la curación, fiabilidad de aplicación y momento. Otro compañero puede ser mejor portador si aplica el efecto con más constancia.' },
      { id: 'only_after_loss', text: 'Después de perder una pelea, cuando ya tenga una prueba en el marcador', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'La pelea aporta evidencia, pero esperar siempre a perder entrega una ventana que podía anticiparse observando héroes, objetos y patrón de combate.' },
      { id: 'raw_damage', text: 'Tras completar todo mi daño, porque matar antes sustituye cualquier anti-curación', evaluation: 'RISKY', score: 0.2, feedback: 'Más daño puede ser la respuesta si la curación es pequeña, pero no la sustituye cuando el rival sobrevive y recupera repetidamente durante la pelea.' },
      unknown('El coach enseñará a distinguir presencia de curación y relevancia de curación.'),
    ],
    principle: 'Anti-curación es una respuesta funcional, no una compra automática.', knowledgeKeys: ['anti_heal'],
  },
  {
    key: 'placement-v2-damage-defence', competencyKey: 'builds', level: 2,
    prompt: 'Recibes daño físico y mágico, pero un único rival con ventaja te elimina al entrar. ¿Cómo eliges tu defensa?',
    context: 'El resumen final muestra daño mixto, aunque no todas las fuentes tienen la misma capacidad de alcanzarte.',
    options: [
      { id: 'total_only', text: 'Cubrir el tipo de daño que tenga el porcentaje total más alto', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'El reparto total orienta, pero mezcla daño relevante, poke recuperable y daño recibido por otros patrones de exposición.' },
      { id: 'health_only', text: 'Priorizar vida para repartir por igual la defensa contra ambas fuentes', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'La vida ayuda frente a daño mixto, pero puede ser insuficiente contra una fuente dominante, daño porcentual o una forma concreta de acceso.' },
      { id: 'threat_source', text: 'Responder al rival decisivo, su tipo de daño y su forma de alcanzarme', evaluation: 'ADEQUATE', score: 1, feedback: 'La defensa debe permitirte sobrevivir a la secuencia que realmente te elimina. Si cambia quién puede alcanzarte, también puede cambiar la compra correcta.' },
      unknown('El coach te ayudará a identificar amenaza, acceso y respuesta.'),
    ],
    principle: 'Defenderse es responder a una amenaza concreta, no sólo a un porcentaje agregado.', knowledgeKeys: ['damage_defence'],
  },
  {
    key: 'placement-v2-combat-role', competencyKey: 'micro_concepts', level: 2,
    prompt: 'Juegas desde la retaguardia y la pelea empieza con un tanque rival a tu alcance. ¿Cómo actúas?',
    context: 'El iniciador enemigo conserva la habilidad que puede alcanzarte y tu equipo necesita daño sostenido.',
    options: [
      { id: 'follow_engage', text: 'Cruzar con mi iniciador para alcanzar cuanto antes la retaguardia rival', evaluation: 'RISKY', score: 0.2, feedback: 'Puede castigar una ventana concreta, pero aquí te expone mientras la herramienta que te amenaza continúa disponible.' },
      { id: 'function', text: 'Golpear desde alcance útil y guardar distancia frente a la entrada rival', evaluation: 'ADEQUATE', score: 1, feedback: 'Mantienes tu función sin ofrecer al rival su acceso preferido. Si la amenaza gasta su entrada o queda aislada, el límite seguro puede avanzar.' },
      { id: 'wait_all', text: 'Esperar fuera hasta que el rival haya gastado todas sus habilidades importantes', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'Esperar una habilidad crítica puede ser correcto, pero desaparecer por completo deja al equipo sin presión mientras todavía existía alcance seguro.' },
      unknown('El coach simplificará cada pelea en función, amenaza y salida.'),
    ],
    principle: 'La función en la pelea depende del héroe y del estado, no sólo del marcador.', knowledgeKeys: ['combat'],
  },
  {
    key: 'placement-v2-replay-causality', competencyKey: 'review_autonomy', level: 2,
    prompt: 'RiftLine detecta una muerte 40 segundos antes de Prime. ¿Cómo usarías ese dato?',
    context: 'La API conoce el momento de la muerte y del objetivo, pero no el movimiento continuo ni la comunicación.',
    options: [
      { id: 'bad_position', text: 'Clasificarla como error de posición porque debilitó el siguiente objetivo', evaluation: 'RISKY', score: 0.25, feedback: 'El impacto temporal es visible, pero no demuestra la causa: podía ser una defensa necesaria, información incompleta o una ejecución distinta.' },
      { id: 'review_window', text: 'Marcar el momento y revisar visión, recursos e intención antes de concluir', evaluation: 'ADEQUATE', score: 1, feedback: 'El timeline identifica una ventana con posible impacto. El replay debe confirmar qué información había, qué se intentaba y qué alternativa existía.' },
      { id: 'irrelevant', text: 'Excluirla del análisis porque los eventos no explican el movimiento previo', evaluation: 'RISKY', score: 0.15, feedback: 'No poder demostrar la causa con la API no vuelve irrelevante el momento; indica exactamente dónde hace falta revisar el vídeo.' },
      unknown('Aprenderás a separar hecho, inferencia e hipótesis.'),
    ],
    principle: 'El timeline localiza; el replay explica.', knowledgeKeys: ['combat', 'objectives'],
  },
  {
    key: 'placement-v2-tempo', competencyKey: 'macro', level: 3,
    prompt: 'Completas un objeto, un rival vuelve a base y la oleada central está empujada. ¿Cómo aprovechas la ventana?',
    context: 'La ventaja dura hasta que el rival regrese y convierta también sus recursos.',
    options: [
      { id: 'recall_again', text: 'Volver otra vez para proteger la ventaja y evitar una pelea innecesaria', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Conservarse puede ser sensato si no existe una jugada útil, pero aquí consume una ventana creada por compra, ausencia y prioridad.' },
      { id: 'extra_farm', text: 'Limpiar recursos propios hasta que el rival vuelva para ampliar el oro total', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'Farmear convierte parte de la ventana en economía segura, aunque renuncia a presión que quizá no exista cuando el rival regrese.' },
      { id: 'act_first', text: 'Preparar visión o presión sobre la siguiente jugada antes de su regreso', evaluation: 'ADEQUATE', score: 1, feedback: 'Usas el poder comprado, la ausencia rival y la prioridad para actuar primero. No obliga a forzar una pelea si no aparecen condiciones.' },
      unknown('El coach relacionará compras, oleadas y ausencias con ventanas de acción.'),
    ],
    principle: 'Tempo es tiempo útil para actuar antes de la respuesta rival.', knowledgeKeys: ['tempo'],
  },
  {
    key: 'placement-v2-pool-function', competencyKey: 'champion_pool', level: 2,
    prompt: 'Tu héroe principal funciona bien, pero sufre cuando el equipo necesita otra función. ¿Cómo eliges una segunda opción?',
    context: 'Quieres ampliar tus respuestas sin repartir la práctica entre demasiados héroes.',
    options: [
      { id: 'same', text: 'Elegir uno de mecánicas parecidas aunque conserve las mismas debilidades', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'La transferencia mecánica acelera el aprendizaje, pero una alternativa que repite las mismas carencias ofrece poca cobertura estratégica.' },
      { id: 'coverage', text: 'Elegir uno que cubra esa función y pueda practicar con suficiente frecuencia', evaluation: 'ADEQUATE', score: 1, feedback: 'La elección amplía tus respuestas y sigue permitiendo práctica deliberada. No tiene que cubrir todos los matchups ni liderar las estadísticas globales.' },
      { id: 'many', text: 'Añadir el héroe con mayor tasa de victoria cada vez que cambie el parche', evaluation: 'RISKY', score: 0.2, feedback: 'El meta aporta contexto, pero perseguirlo sin dominio ni función clara crea un pool amplio y poco transferible entre parches.' },
      unknown('El coach distinguirá profundidad, alternativa y cobertura del rol.'),
    ],
    principle: 'Un pool pequeño y complementario enseña mejor que una colección amplia sin dominio.', knowledgeKeys: ['role'],
  },
  {
    key: 'placement-v2-role-support-priority', competencyKey: 'role_knowledge', level: 2, roles: ['SUPPORT'],
    prompt: 'Tu Carry va por delante y el asesino rival conserva su entrada. ¿Cómo planteas la siguiente pelea como Support?',
    context: 'Tu control principal puede iniciar sobre la primera línea o interrumpir al rival que salte sobre tu Carry.',
    options: [
      { id: 'layer_frontline', text: 'Encadenar el control sobre la primera línea en cuanto mi tanque entre', evaluation: 'DEFENSIBLE', score: 0.45, feedback: 'Puede asegurar una baja rápida, pero gastar la herramienta clave deja abierta la entrada del asesino que aún amenaza a tu condición de victoria.' },
      { id: 'protect_win_condition', text: 'Mantener rango de protección y reservar el control para negar su entrada', evaluation: 'ADEQUATE', score: 1, feedback: 'Con estos datos, proteger al Carry tiene mayor valor. Si el asesino gasta su entrada o aparece una iniciación decisiva, la prioridad puede cambiar.' },
      { id: 'front_scout', text: 'Avanzar por delante para localizar al asesino antes de que pueda entrar', evaluation: 'RISKY', score: 0.2, feedback: 'Obtener información importa, pero exponerte puede eliminar precisamente las herramientas que el Carry necesita para sobrevivir.' },
      unknown('El coach trabajará la función de Support según la condición de victoria.'),
    ],
    principle: 'Support alterna iniciar, proteger y negar espacio según la condición de victoria.', knowledgeKeys: ['support_role', 'combat'],
  },
  {
    key: 'placement-v2-role-carry-priority', competencyKey: 'role_knowledge', level: 2, roles: ['CARRY'],
    prompt: 'Un tanque está a tu alcance y el Carry rival permanece detrás de varias amenazas. ¿Qué priorizas?',
    context: 'Puedes dañar al tanque desde una posición estable, pero alcanzar la retaguardia exige cruzar el control rival.',
    options: [
      { id: 'enemy_carry', text: 'Cruzar con el iniciador para intentar eliminar primero al Carry rival', evaluation: 'RISKY', score: 0.2, feedback: 'Eliminar al Carry rival sería valioso, pero atravesar control elimina tu daño sostenido si no existe una ruta segura o una ventaja clara.' },
      { id: 'safe_target', text: 'Dañar al objetivo alcanzable y avanzar sólo cuando cambien las amenazas', evaluation: 'ADEQUATE', score: 1, feedback: 'Mantienes actividad y supervivencia mientras esperas que se abran objetivos mejores. El tanque no es siempre la prioridad, pero aquí es el objetivo seguro disponible.' },
      { id: 'hold_damage', text: 'Esperar sin atacar hasta que el Carry rival quede dentro de mi alcance', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Conservar posición puede evitar una muerte, pero renunciar a todo daño también permite que la primera línea rival actúe sin coste.' },
      unknown('El coach enseñará alcance útil, amenazas y continuidad de daño.'),
    ],
    principle: 'Carry prioriza daño sostenible sobre el objetivo alcanzable sin regalar su posición.', knowledgeKeys: ['carry_role', 'combat'],
  },
  {
    key: 'placement-v2-role-jungle-priority', competencyKey: 'role_knowledge', level: 3, roles: ['JUNGLE'],
    prompt: 'Faltan 70 segundos para un objetivo y tus campamentos reaparecen en ese lado. ¿Cómo ajustas la ruta?',
    context: 'La línea cercana no tiene prioridad y el Jungla rival ha sido visto en el lado opuesto del mapa.',
    options: [
      { id: 'gank_low_priority', text: 'Forzar primero la línea cercana para crear prioridad antes de farmear', evaluation: 'RISKY', score: 0.25, feedback: 'Crear prioridad sería útil, pero una línea sin condiciones puede convertir el gank en tiempo perdido y retrasar preparación y recursos.' },
      { id: 'resources_windows', text: 'Limpiar hacia el objetivo y reevaluar la línea con la nueva información', evaluation: 'ADEQUATE', score: 1, feedback: 'La ruta conecta economía, ubicación futura e información. Si aparece una ventana clara o cambia la posición rival, puedes romper el plan sin perder su intención.' },
      { id: 'full_clear', text: 'Completar toda la jungla aunque termine en el lado contrario al objetivo', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'El full clear protege economía, pero aquí termina lejos de una ventana conocida y obliga a pagar después el desplazamiento.' },
      unknown('El coach no juzgará pathing sin replay, pero enseñará sus variables.'),
    ],
    principle: 'Pathing es una asignación contextual de tiempo y recursos.', knowledgeKeys: ['jungle_role', 'tempo'],
  },
  {
    key: 'placement-v2-role-mid-priority', competencyKey: 'role_knowledge', level: 2, roles: ['MIDLANE'],
    prompt: 'Empujas la línea central, pero no ves al Jungla rival. ¿Cómo utilizas la prioridad?',
    context: 'No ves al Jungla rival y la jugada lateral todavía no ofrece una ventaja clara.',
    options: [
      { id: 'rotate_now', text: 'Entrar ya al río porque empujar obliga al rival a responder la oleada', evaluation: 'RISKY', score: 0.3, feedback: 'La prioridad abre la ruta, pero la ausencia del Jungla y la falta de una jugada clara hacen que la rotación pueda entregar el tiempo ganado.' },
      { id: 'evaluate', text: 'Tomar información o recurso seguro y rotar si aparece una ventana real', evaluation: 'ADEQUATE', score: 1, feedback: 'La prioridad crea opciones: visión, recurso, apoyo o presión. No obliga a rotar; la información y el coste de la siguiente oleada deciden.' },
      { id: 'hold_mid', text: 'Permanecer visible en medio hasta que llegue la siguiente oleada', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'Protege la línea y reduce riesgo, pero puede desperdiciar parte del tiempo libre que permitiría obtener información o un recurso cercano.' },
      unknown('El coach enseñará a convertir prioridad en una elección, no en una obligación.'),
    ],
    principle: 'La prioridad central abre opciones; el contexto decide cuál usar.', knowledgeKeys: ['midlane_role', 'tempo'],
  },
  {
    key: 'placement-v2-role-offlane-priority', competencyKey: 'role_knowledge', level: 3, roles: ['OFFLANE'],
    prompt: 'Faltan 45 segundos para un objetivo decisivo y tu equipo necesita tu primera línea. ¿Qué haces?',
    context: 'Estás en la línea lateral, puedes resolver la oleada actual y todavía llegar antes de que empiece la disputa.',
    options: [
      { id: 'take_tower', text: 'Quedarme hasta amenazar la torre y obligar al rival a responder', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'La presión lateral puede forzar una respuesta, pero el contexto dice que tu equipo no puede esperar y necesita tu función en la disputa.' },
      { id: 'team_window', text: 'Resolver la oleada actual y rotar antes de que el rival ocupe la zona', evaluation: 'ADEQUATE', score: 1, feedback: 'Conservas parte de la presión sin sacrificar presencia en la ventana decisiva. Si el equipo pudiera retrasar o tu presión terminara la partida, el cálculo sería distinto.' },
      { id: 'late_recall', text: 'Seguir farmeando y volver a base cuando el objetivo ya haya aparecido', evaluation: 'RISKY', score: 0.2, feedback: 'Retrasa la compra y el desplazamiento hasta el momento en que el rival ya puede controlar accesos o iniciar el objetivo.' },
      unknown('El coach enseñará a comparar presión lateral y presencia colectiva.'),
    ],
    principle: 'Offlane convierte presión en valor y reconoce cuándo la presencia pesa más.', knowledgeKeys: ['offlane_role', 'objectives'],
  },
];

export const LEARNING_QUESTIONS: LearningQuestion[] = PLACEMENT_QUESTIONS_V3;

export interface MissionTemplate {
  key: string;
  competencyKey: CompetencyKey;
  minLevel: number;
  title: string;
  cue: string;
  targetMatches: number;
  observable: boolean;
  successCriteria: Record<string, unknown>;
  replayChecks: string[];
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  { key: 'mission-map-check', competencyKey: 'moba_fundamentals', minLevel: 1, title: 'Tres comprobaciones antes de actuar', cue: 'Antes de una decisión importante, comprueba objetivo, aliados visibles y oro disponible.', targetMatches: 3, observable: false, successCriteria: { type: 'reflection', confirmationsRequired: 3 }, replayChecks: ['¿Qué información estaba visible?', '¿Qué recurso intentabas conseguir?', '¿Qué alternativa segura existía?'] },
  { key: 'mission-role-function', competencyKey: 'role_knowledge', minLevel: 1, title: 'Define tu función antes de la pelea', cue: 'Nombra mentalmente tu función: iniciar, proteger, controlar, causar daño o negar espacio.', targetMatches: 5, observable: false, successCriteria: { type: 'reflection', confirmationsRequired: 3 }, replayChecks: ['¿Qué función elegiste?', '¿Cambió durante la pelea?', '¿Tu posición permitía cumplirla?'] },
  { key: 'mission-objective-life', competencyKey: 'macro', minLevel: 1, title: 'Llega vivo al siguiente objetivo', cue: 'Reduce riesgos evitables durante los 90 segundos anteriores a cada objetivo mayor.', targetMatches: 5, observable: true, successCriteria: { type: 'deaths_before_objective', maxAverage: 1 }, replayChecks: ['¿Qué riesgo asumiste antes del objetivo?', '¿Habías comprado?', '¿Tu equipo podía responder?'] },
  { key: 'mission-fight-plan', competencyKey: 'micro_concepts', minLevel: 1, title: 'Función, amenaza y salida', cue: 'Antes de entrar, identifica tu función, la habilidad que más te amenaza y una ruta de salida.', targetMatches: 5, observable: false, successCriteria: { type: 'reflection', confirmationsRequired: 3 }, replayChecks: ['¿Cuál era tu función?', '¿Qué amenaza debías esperar?', '¿Dónde estaba tu salida?'] },
  { key: 'mission-build-checkpoint', competencyKey: 'builds', minLevel: 1, title: 'Pausa de adaptación en cada compra', cue: 'Antes de completar la segunda y tercera pieza, revisa amenazas, resistencias, curación y siguiente objetivo.', targetMatches: 5, observable: true, successCriteria: { type: 'build_review', maxCriticalSignals: 0, maxWarningAverage: 1 }, replayChecks: ['¿Qué problema resolvía la compra?', '¿Qué pieza retrasaste?', '¿Cambió la amenaza después?'] },
  { key: 'mission-pool-alternative', competencyKey: 'champion_pool', minLevel: 1, title: 'Una alternativa con una función clara', cue: 'Practica una segunda elección que cubra una necesidad distinta de tu héroe principal.', targetMatches: 5, observable: true, successCriteria: { type: 'alternative_hero_matches', minimum: 2 }, replayChecks: ['¿Qué necesidad cubría?', '¿Qué fundamento se transfirió?', '¿Qué cambió en tu responsabilidad?'] },
  { key: 'mission-replay-conclusion', competencyKey: 'review_autonomy', minLevel: 1, title: 'Confirma tres momentos en replay', cue: 'Separa hecho, hipótesis y conclusión antes de decidir qué practicar.', targetMatches: 3, observable: true, successCriteria: { type: 'replay_reviews', minimum: 3 }, replayChecks: ['¿Qué sabes con certeza?', '¿Qué observaste en el vídeo?', '¿Qué principio transferirás?'] },
];

export function levelLabel(level: number): string {
  return LEARNING_LEVELS.find((entry) => entry.level === level)?.label ?? LEARNING_LEVELS[0].label;
}

export function competencyLabel(key: string): string {
  return COMPETENCIES.find((entry) => entry.key === key)?.label ?? key;
}
