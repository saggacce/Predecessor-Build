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

export const LEARNING_QUESTIONS: LearningQuestion[] = [
  {
    key: 'placement-gold-conversion', competencyKey: 'moba_fundamentals', level: 1,
    prompt: 'Tienes bastante oro, pero todavía no has vuelto a base. ¿Qué significa realmente ese oro?',
    context: 'No hay un objetivo inmediato y puedes regresar sin perder una oleada importante.',
    options: [
      { id: 'buy', text: 'Sólo se convierte en poder cuando compro', evaluation: 'ADEQUATE', score: 1, feedback: 'Correcto: el oro guardado permite una compra futura, pero todavía no aporta estadísticas.' },
      { id: 'already_power', text: 'Ya aumenta automáticamente mi daño y defensa', evaluation: 'RISKY', score: 0, feedback: 'El oro no modifica tus estadísticas hasta que completas una compra.' },
      { id: 'kills_only', text: 'Sólo sirve para comparar quién tiene más bajas', evaluation: 'RISKY', score: 0, feedback: 'El oro es el recurso que permite comprar componentes y completar picos de poder.' },
      unknown('Esta duda será el primer concepto que trabajará el coach.'),
    ],
    principle: 'El oro acumulado se convierte en poder al comprar; el momento de volver a base también tiene un coste.', knowledgeKeys: ['economy'],
  },
  {
    key: 'placement-objective-setup', competencyKey: 'macro', level: 1,
    prompt: 'Faltan 50 segundos para Fangtooth. ¿Cuál es la preparación más completa?',
    context: 'Tu equipo puede disputar el objetivo y varios jugadores tienen oro para comprar.',
    options: [
      { id: 'prepare', text: 'Comprar, resolver oleadas seguras, conservar recursos y preparar información', evaluation: 'ADEQUATE', score: 1, feedback: 'Es una preparación completa: crea mejores condiciones antes de empezar el objetivo.' },
      { id: 'hit_now', text: 'Atacarlo inmediatamente aunque el equipo no haya comprado', evaluation: 'RISKY', score: 0, feedback: 'Empezar primero no compensa llegar con menos poder, vida o información.' },
      { id: 'wait_spawn', text: 'Esperar a que aparezca y decidir entonces', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'Puede evitar un error precipitado, pero entrega la preparación previa al rival.' },
      unknown('El coach explicará las cuatro piezas de una preparación de objetivo.'),
    ],
    principle: 'Los objetivos se preparan antes de aparecer.', knowledgeKeys: ['objectives', 'tempo'],
  },
  {
    key: 'placement-vision-purpose', competencyKey: 'macro', level: 1,
    prompt: '¿Qué hace que un ward sea realmente útil?',
    context: 'Dos wards pueden colocarse en el mismo minuto, pero en zonas y momentos diferentes.',
    options: [
      { id: 'decision', text: 'Que llegue a tiempo, cubra una ruta relevante y permita tomar una decisión', evaluation: 'ADEQUATE', score: 1, feedback: 'La visión se valora por la información accionable que crea.' },
      { id: 'counter', text: 'Colocar el mayor número posible sin importar dónde', evaluation: 'RISKY', score: 0, feedback: 'El volumen aislado no demuestra utilidad y puede concentrar visión donde no hace falta.' },
      { id: 'deep', text: 'Que siempre esté lo más profundo posible', evaluation: 'RISKY', score: 0, feedback: 'Entrar sin prioridad para colocar visión profunda puede generar una muerte evitable.' },
      unknown('La misión inicial de visión se centrará en relacionar cada ward con una decisión.'),
    ],
    principle: 'Un ward vale por la decisión que habilita.', knowledgeKeys: ['vision'],
  },
  {
    key: 'placement-build-function', competencyKey: 'builds', level: 1,
    prompt: '¿Cómo debería construirse una build útil?',
    context: 'Tu héroe necesita un núcleo para funcionar, pero la composición rival presenta amenazas concretas.',
    options: [
      { id: 'core_adapt', text: 'Conservar un núcleo funcional y adaptar las piezas situacionales', evaluation: 'ADEQUATE', score: 1, feedback: 'La build mantiene la identidad del héroe sin ignorar el estado real de la partida.' },
      { id: 'fixed', text: 'Copiar siempre el mismo orden completo', evaluation: 'RISKY', score: 0, feedback: 'Una receta fija no responde a curación, resistencias, control ni distribución de amenazas.' },
      { id: 'counter_all', text: 'Cambiar todos los objetos para contrarrestar al rival', evaluation: 'RISKY', score: 0.2, feedback: 'Adaptar todo puede impedir que el héroe cumpla su propia función.' },
      unknown('El coach separará núcleo, adaptación y coste de oportunidad.'),
    ],
    principle: 'Una build combina identidad del héroe y respuesta contextual.', knowledgeKeys: ['build_adaptation'],
  },
  {
    key: 'placement-antiheal', competencyKey: 'builds', level: 2,
    prompt: '¿Cuándo gana valor una compra de anti-curación?',
    context: 'El rival tiene varias fuentes de curación, pero completar el objeto retrasa otra pieza importante.',
    options: [
      { id: 'relevant_repeatable', text: 'Cuando la curación es relevante, repetida y puedo aplicar el efecto en peleas importantes', evaluation: 'ADEQUATE', score: 1, feedback: 'La necesidad, la aplicación y el momento determinan el valor real de anti-curación.' },
      { id: 'any_heal', text: 'Siempre que exista cualquier cantidad de curación', evaluation: 'RISKY', score: 0.2, feedback: 'Una cantidad pequeña puede no justificar retrasar una compra más importante.' },
      { id: 'only_after_loss', text: 'Sólo después de perder una pelea por esa curación', evaluation: 'DEFENSIBLE', score: 0.4, feedback: 'La pelea aporta evidencia, pero reconocer la amenaza antes permite adaptar a tiempo.' },
      unknown('El coach enseñará a distinguir presencia de curación y relevancia de curación.'),
    ],
    principle: 'Anti-curación es una respuesta funcional, no una compra automática.', knowledgeKeys: ['anti_heal'],
  },
  {
    key: 'placement-damage-defence', competencyKey: 'builds', level: 2,
    prompt: '¿Qué debes comprobar antes de elegir una defensa?',
    context: 'Has recibido daño físico y mágico, pero un único rival está decidiendo las peleas.',
    options: [
      { id: 'threat_source', text: 'Quién es la amenaza, qué daño aplica y cuándo puede alcanzarme', evaluation: 'ADEQUATE', score: 1, feedback: 'La amenaza relevante importa más que repartir defensas según el total final sin contexto.' },
      { id: 'total_only', text: 'Elegir únicamente el tipo de daño con el total final más alto', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'El total orienta, pero puede ocultar qué enemigo decide realmente las peleas.' },
      { id: 'health_only', text: 'Comprar siempre vida porque sirve contra todo', evaluation: 'RISKY', score: 0.1, feedback: 'La vida tiene valor general, pero no reemplaza siempre resistencias o herramientas específicas.' },
      unknown('El coach te ayudará a identificar amenaza, acceso y respuesta.'),
    ],
    principle: 'Defenderse es responder a una amenaza concreta, no sólo a un porcentaje agregado.', knowledgeKeys: ['damage_defence'],
  },
  {
    key: 'placement-combat-role', competencyKey: 'micro_concepts', level: 2,
    prompt: 'Antes de una pelea, ¿qué pregunta es más útil?',
    context: 'Tu héroe puede aportar control, daño o protección según la composición y el momento.',
    options: [
      { id: 'function', text: '¿Cuál es mi función, mi amenaza principal y mi ruta de salida?', evaluation: 'ADEQUATE', score: 1, feedback: 'Estas tres comprobaciones convierten la entrada en una decisión con intención.' },
      { id: 'first_target', text: '¿A quién puedo golpear primero, sin importar mi función?', evaluation: 'RISKY', score: 0.2, feedback: 'El primer objetivo visible no siempre es el objetivo correcto ni justifica exponerse.' },
      { id: 'damage', text: '¿Cómo consigo el mayor daño posible?', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Puede ser correcto para algunos Carry, pero ignora control, protección, alcance y supervivencia.' },
      unknown('El coach simplificará cada pelea en función, amenaza y salida.'),
    ],
    principle: 'La función en la pelea depende del héroe y del estado, no sólo del marcador.', knowledgeKeys: ['combat'],
  },
  {
    key: 'placement-replay-causality', competencyKey: 'review_autonomy', level: 1,
    prompt: 'RiftLine detecta una muerte 40 segundos antes de Prime. ¿Qué puede concluir?',
    context: 'La API conoce el momento de la muerte y del objetivo, pero no el movimiento continuo ni la comunicación.',
    options: [
      { id: 'review_window', text: 'Es una ventana importante que debo revisar, pero la causa aún no está demostrada', evaluation: 'ADEQUATE', score: 1, feedback: 'Los eventos localizan el momento; el replay confirma información, intención y alternativas.' },
      { id: 'bad_position', text: 'Que estaba mal posicionado con certeza', evaluation: 'RISKY', score: 0, feedback: 'Sin replay no se conocen visión, enfriamientos, oleadas, intención ni comunicación.' },
      { id: 'irrelevant', text: 'Que la muerte no tiene relación posible con el objetivo', evaluation: 'RISKY', score: 0.1, feedback: 'La proximidad temporal es relevante, aunque no pruebe causalidad.' },
      unknown('Aprenderás a separar hecho, inferencia e hipótesis.'),
    ],
    principle: 'El timeline localiza; el replay explica.', knowledgeKeys: ['combat', 'objectives'],
  },
  {
    key: 'placement-tempo', competencyKey: 'macro', level: 2,
    prompt: '¿Qué describe mejor una ventana de tempo?',
    context: 'Acabas de completar un objeto, un rival ha vuelto a base y una oleada está empujada.',
    options: [
      { id: 'act_first', text: 'Una ventaja temporal para actuar antes de una respuesta equivalente', evaluation: 'ADEQUATE', score: 1, feedback: 'La compra, la ausencia rival y la oleada pueden crear una ventana que no dura para siempre.' },
      { id: 'play_fast', text: 'Moverse siempre lo más rápido posible', evaluation: 'RISKY', score: 0.1, feedback: 'Tempo no significa precipitarse; significa reconocer quién puede actuar primero y con qué recursos.' },
      { id: 'gold_lead', text: 'Tener más oro total durante toda la partida', evaluation: 'DEFENSIBLE', score: 0.3, feedback: 'Una ventaja de oro puede crear tempo, pero el concepto describe una ventana de acción temporal.' },
      unknown('El coach relacionará compras, oleadas y ausencias con ventanas de acción.'),
    ],
    principle: 'Tempo es tiempo útil para actuar antes de la respuesta rival.', knowledgeKeys: ['tempo'],
  },
  {
    key: 'placement-pool-function', competencyKey: 'champion_pool', level: 2,
    prompt: '¿Qué hace que una segunda elección mejore de verdad tu champion pool?',
    context: 'Ya tienes un héroe principal, pero algunas partidas exigen una función diferente.',
    options: [
      { id: 'coverage', text: 'Que cubra una necesidad o matchup que mi héroe principal resuelve mal', evaluation: 'ADEQUATE', score: 1, feedback: 'Una alternativa funcional amplía tus respuestas sin dispersar demasiado la práctica.' },
      { id: 'many', text: 'Tener tantos héroes como sea posible', evaluation: 'RISKY', score: 0.1, feedback: 'Demasiadas elecciones reducen la práctica deliberada y no garantizan cobertura funcional.' },
      { id: 'same', text: 'Que haga exactamente lo mismo que mi héroe principal', evaluation: 'DEFENSIBLE', score: 0.35, feedback: 'Puede facilitar la transferencia, pero aporta poca cobertura frente a necesidades distintas.' },
      unknown('El coach distinguirá profundidad, alternativa y cobertura del rol.'),
    ],
    principle: 'Un pool pequeño y complementario enseña mejor que una colección amplia sin dominio.', knowledgeKeys: ['role'],
  },
  {
    key: 'role-support-priority', competencyKey: 'role_knowledge', level: 2, roles: ['SUPPORT'],
    prompt: 'Como Support, ¿cómo eliges entre iniciar y proteger?',
    context: 'Tu Carry puede ganar una pelea larga, pero el rival tiene una entrada fuerte sobre él.',
    options: [
      { id: 'protect_win_condition', text: 'Conservo herramientas para proteger al aliado que puede ganar la pelea', evaluation: 'ADEQUATE', score: 1, feedback: 'Cuando el Carry es la condición de victoria y está amenazado, proteger puede valer más que iniciar.' },
      { id: 'always_engage', text: 'Inicio siempre porque Support debe empezar peleas', evaluation: 'RISKY', score: 0, feedback: 'Support no tiene una única función; composición, amenazas y recursos cambian la prioridad.' },
      { id: 'never_engage', text: 'Nunca inicio y permanezco siempre detrás', evaluation: 'RISKY', score: 0.15, feedback: 'Proteger no significa renunciar a controlar espacio o castigar una entrada segura.' },
      unknown('El coach trabajará la función de Support según la condición de victoria.'),
    ],
    principle: 'Support alterna iniciar, proteger y negar espacio según la condición de victoria.', knowledgeKeys: ['support_role', 'combat'],
  },
  {
    key: 'role-carry-priority', competencyKey: 'role_knowledge', level: 2, roles: ['CARRY'],
    prompt: 'Como Carry, ¿qué objetivo suele ser más correcto durante una pelea?',
    context: 'Un tanque está a tu alcance y el Carry rival está lejos detrás de varias amenazas.',
    options: [
      { id: 'safe_target', text: 'El objetivo valioso que puedo golpear sin atravesar amenazas', evaluation: 'ADEQUATE', score: 1, feedback: 'Mantener daño sostenido desde una distancia segura suele superar perseguir un objetivo inaccesible.' },
      { id: 'enemy_carry', text: 'Siempre el Carry rival aunque deba cruzar toda la pelea', evaluation: 'RISKY', score: 0, feedback: 'Atravesar amenazas puede eliminar tu daño sostenido antes de que produzca valor.' },
      { id: 'lowest_health', text: 'Siempre quien tenga menos vida', evaluation: 'DEFENSIBLE', score: 0.25, feedback: 'La vida importa, pero también alcance, peligro y tiempo necesario para asegurar la baja.' },
      unknown('El coach enseñará alcance útil, amenazas y continuidad de daño.'),
    ],
    principle: 'Carry prioriza daño sostenible sobre el objetivo alcanzable sin regalar su posición.', knowledgeKeys: ['carry_role', 'combat'],
  },
  {
    key: 'role-jungle-priority', competencyKey: 'role_knowledge', level: 2, roles: ['JUNGLE'],
    prompt: '¿Cómo se evalúa una ruta de Jungla?',
    context: 'Hay campamentos disponibles, una línea con poca prioridad y un objetivo próximo.',
    options: [
      { id: 'resources_windows', text: 'Por recursos, prioridad de líneas, información y próxima ventana de objetivo', evaluation: 'ADEQUATE', score: 1, feedback: 'La ruta distribuye tiempo entre economía, presión y objetivos; no se mide sólo con ganks.' },
      { id: 'ganks', text: 'Por conseguir el mayor número posible de ganks', evaluation: 'RISKY', score: 0.15, feedback: 'Forzar líneas sin condiciones puede perder campamentos, tempo y control del siguiente objetivo.' },
      { id: 'full_clear', text: 'Por limpiar siempre todos los campamentos antes de actuar', evaluation: 'DEFENSIBLE', score: 0.3, feedback: 'El recurso seguro importa, pero una ventana clara puede justificar cambiar la ruta.' },
      unknown('El coach no juzgará pathing sin replay, pero enseñará sus variables.'),
    ],
    principle: 'Pathing es una asignación contextual de tiempo y recursos.', knowledgeKeys: ['jungle_role', 'tempo'],
  },
  {
    key: 'role-mid-priority', competencyKey: 'role_knowledge', level: 2, roles: ['MIDLANE'],
    prompt: 'Después de empujar la línea central, ¿debes rotar siempre?',
    context: 'No ves al Jungla rival y la jugada lateral todavía no ofrece una ventaja clara.',
    options: [
      { id: 'evaluate', text: 'No; comparo información, coste de abandonar línea y probabilidad de generar valor', evaluation: 'ADEQUATE', score: 1, feedback: 'La prioridad crea opciones, pero no obliga a elegir siempre la rotación.' },
      { id: 'always_rotate', text: 'Sí; empujar significa que debo abandonar la línea', evaluation: 'RISKY', score: 0.1, feedback: 'Rotar sin información o sin una ventana real puede regalar tiempo y recursos.' },
      { id: 'never_rotate', text: 'No; Midlane sólo debe permanecer en su línea', evaluation: 'RISKY', score: 0, feedback: 'La posición central permite influir en ambos lados cuando existen condiciones.' },
      unknown('El coach enseñará a convertir prioridad en una elección, no en una obligación.'),
    ],
    principle: 'La prioridad central abre opciones; el contexto decide cuál usar.', knowledgeKeys: ['midlane_role', 'tempo'],
  },
  {
    key: 'role-offlane-priority', competencyKey: 'role_knowledge', level: 2, roles: ['OFFLANE'],
    prompt: '¿Cuándo deja de ser útil seguir presionando una línea lateral?',
    context: 'Tu equipo se prepara para un objetivo que puede decidir la partida y no puede esperar una pelea larga.',
    options: [
      { id: 'team_window', text: 'Cuando la presión no compensa perder mi presencia en la ventana decisiva', evaluation: 'ADEQUATE', score: 1, feedback: 'La presión debe compararse con el valor y la urgencia de la jugada colectiva.' },
      { id: 'always_split', text: 'Nunca; Offlane debe presionar siempre', evaluation: 'RISKY', score: 0, feedback: 'Una regla fija ignora objetivos, movilidad, composición y capacidad del equipo para esperar.' },
      { id: 'always_group', text: 'En cuanto el equipo se agrupe, aunque la jugada ya esté perdida', evaluation: 'DEFENSIBLE', score: 0.3, feedback: 'Agruparse puede ser correcto, pero llegar tarde a una pelea perdida también desperdicia la presión lateral.' },
      unknown('El coach enseñará a comparar presión lateral y presencia colectiva.'),
    ],
    principle: 'Offlane convierte presión en valor y reconoce cuándo la presencia pesa más.', knowledgeKeys: ['offlane_role', 'objectives'],
  },
];

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
