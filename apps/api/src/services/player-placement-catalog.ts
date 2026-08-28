import type { LearningQuestion, LearningQuestionOption, QuestionEvaluation } from './player-learning-catalog.js';

export const PLACEMENT_REVISION = 'placement-v3';
export const PLACEMENT_QUESTION_COUNT = 20;
export const PLACEMENT_GENERAL_COUNT = 14;
export const PLACEMENT_ROLE_COUNT = 6;

type OptionDefinition = [
  id: string,
  text: string,
  evaluation: QuestionEvaluation,
  score: number,
  feedback: string,
];

function question(input: Omit<LearningQuestion, 'key' | 'options'> & {
  slug: string;
  options: [OptionDefinition, OptionDefinition, OptionDefinition];
}): LearningQuestion {
  const { slug, options, ...definition } = input;
  const unsure: LearningQuestionOption = {
    id: 'not_sure',
    text: 'No tengo criterio suficiente para decidir',
    evaluation: 'UNKNOWN',
    score: 0,
    feedback: 'Reconocer la duda evita consolidar una regla equivocada y permite asignar una práctica concreta.',
  };
  return {
    ...definition,
    key: `${PLACEMENT_REVISION}-${slug}`,
    options: [
      ...options.map(([id, text, evaluation, score, feedback]) => ({ id, text, evaluation, score, feedback })),
      unsure,
    ],
  };
}

const generalQuestions: LearningQuestion[] = [
  question({
    slug: 'economy-recall-window', competencyKey: 'moba_fundamentals', level: 1,
    prompt: 'Tienes bastante oro sin gastar, acabas de empujar la oleada y no hay una pelea cercana. ¿Qué buscas primero?',
    context: 'Puedes volver a base y regresar antes de que la siguiente oleada importante alcance tu torre.',
    options: [
      ['extend', 'Mantenerme avanzado para conservar presión hasta que aparezca una jugada', 'DEFENSIBLE', 0.4, 'La presión tiene valor, pero sin una jugada concreta arriesga una ventana limpia de compra y regreso.'],
      ['recall', 'Volver, convertir el oro en poder y regresar antes de perder recursos', 'ADEQUATE', 1, 'Convierte la ventaja económica sin pagar una oleada relevante ni exponerse con oro que aún no da estadísticas.'],
      ['roam', 'Rotar con el oro guardado para intentar crear superioridad en otra línea', 'RISKY', 0.2, 'Una rotación concreta podría compensar, pero aquí no existe una ventana que justifique actuar con menos poder efectivo.'],
    ],
    principle: 'El oro sólo se convierte en fuerza de combate cuando se compra.', knowledgeKeys: ['economy', 'tempo'],
  }),
  question({
    slug: 'economy-safe-resources', competencyKey: 'moba_fundamentals', level: 1,
    prompt: 'Vas por detrás en línea y acercarte a varios últimos golpes permite al rival eliminarte. ¿Cuál es tu prioridad?',
    context: 'Puedes permanecer a distancia de experiencia, pero no asegurar cada súbdito sin entrar en su rango de amenaza.',
    options: [
      ['contest', 'Disputar cada último golpe para impedir que la diferencia económica aumente', 'RISKY', 0.15, 'Perder salud o morir por recursos pequeños agranda la diferencia más que ceder algunos últimos golpes.'],
      ['xp', 'Conservar vida y experiencia, tomando sólo el oro que resulte realmente seguro', 'ADEQUATE', 1, 'Preserva niveles y reduce el riesgo de convertir una desventaja pequeña en una muerte y más recursos perdidos.'],
      ['leave', 'Abandonar la línea y buscar recursos en otra zona hasta recuperar la ventaja', 'DEFENSIBLE', 0.35, 'Moverse puede funcionar con una ventana real, pero dejar oleadas y experiencia sin plan suele empeorar la recuperación.'],
    ],
    principle: 'Cuando vas por detrás, conservar experiencia y vida puede valer más que forzar cada moneda.', knowledgeKeys: ['economy', 'lane'],
  }),
  question({
    slug: 'victory-condition', competencyKey: 'moba_fundamentals', level: 1,
    prompt: 'Tu equipo gana una pelea y quedan estructuras expuestas. ¿Qué criterio ordena mejor la siguiente decisión?',
    context: 'Hay bajas posibles en retirada, pero también tiempo limitado para avanzar hacia la base rival.',
    options: [
      ['chase', 'Perseguir las bajas mientras sigan visibles y decidir después qué estructura tomar', 'RISKY', 0.2, 'Las bajas son un medio; perseguirlas puede consumir la ventana que realmente permite avanzar hacia la victoria.'],
      ['convert', 'Elegir la conversión segura que más acerque al equipo a destruir el núcleo', 'ADEQUATE', 1, 'Conecta la pelea ganada con la condición de victoria y compara estructura, objetivo y tiempo disponible.'],
      ['recall', 'Volver todos a base para conservar la ventaja obtenida sin asumir otro riesgo', 'DEFENSIBLE', 0.4, 'Reiniciar puede ser correcto con pocos recursos, pero hacerlo automáticamente desperdicia ventanas seguras de conversión.'],
    ],
    principle: 'Las bajas aportan valor cuando se convierten en recursos, objetivos o acceso al núcleo.', knowledgeKeys: ['win_condition', 'objectives'],
  }),
  question({
    slug: 'objective-preparation', competencyKey: 'macro', level: 2,
    prompt: 'Faltan 55 segundos para Fangtooth y tienes oro para una compra importante. ¿Qué plan ofrece más control?',
    context: 'La oleada cercana puede resolverse a tiempo y el equipo está en condiciones de disputar el objetivo.',
    options: [
      ['farm', 'Tomar otra oleada y caminar al objetivo sin volver para conservar el ritmo', 'DEFENSIBLE', 0.45, 'Puede ser útil si la oleada cambia el mapa, pero desaprovecha una compra antes de una pelea previsible.'],
      ['prepare', 'Resolver la oleada, comprar y llegar juntos con información sobre los accesos', 'ADEQUATE', 1, 'Alinea oleada, compra, agrupación y visión antes de tener que decidir entre iniciar, cebar o ceder.'],
      ['pit', 'Ocupar ya el foso y esperar allí para evitar que el rival llegue primero', 'RISKY', 0.2, 'Entrar demasiado pronto sin compra ni información permite que el rival cierre accesos o gane recursos gratis.'],
    ],
    principle: 'Los objetivos se preparan antes de aparecer; no empiezan al golpear al monstruo.', knowledgeKeys: ['objectives', 'tempo', 'vision'],
  }),
  question({
    slug: 'wave-before-rotation', competencyKey: 'macro', level: 2,
    prompt: 'Ves una posible pelea en el río mientras una oleada grande avanza hacia tu torre. ¿Cómo decides si rotar?',
    context: 'La pelea todavía no ha empezado y no está claro que tu llegada cree una ventaja real.',
    options: [
      ['rotate', 'Rotar de inmediato para ayudar antes de que la posible pelea se cierre', 'RISKY', 0.2, 'Rotar sin evaluar llegada, números y coste puede perder la oleada sin cambiar la pelea.'],
      ['compare', 'Comparar tiempo de llegada, superioridad posible y recursos que perdería', 'ADEQUATE', 1, 'Una buena rotación depende del valor probable de la jugada frente al coste seguro de abandonar la oleada.'],
      ['stay', 'Quedarme a recoger la oleada porque ofrece valor seguro frente a la pelea', 'DEFENSIBLE', 0.35, 'Proteger recursos es sensato, pero una ventana decisiva puede valer más que la oleada si realmente llegas a tiempo.'],
    ],
    principle: 'Rotar es intercambiar recursos seguros por una oportunidad; hay que valorar ambos lados.', knowledgeKeys: ['waves', 'rotations', 'tempo'],
  }),
  question({
    slug: 'vision-with-purpose', competencyKey: 'macro', level: 2,
    prompt: 'Tu equipo quiere jugar alrededor de la jungla derecha. ¿Qué hace que un ward sea realmente útil?',
    context: 'Conoces una ruta probable del rival y tus aliados están suficientemente cerca para reaccionar.',
    options: [
      ['deep', 'Colocarlo lo más profundo posible aunque tenga que entrar sin compañía', 'RISKY', 0.15, 'Una ubicación profunda no compensa regalarse para colocarla ni sirve si llega fuera de tiempo.'],
      ['decision', 'Cubrir a tiempo una ruta cuya información pueda cambiar la siguiente decisión', 'ADEQUATE', 1, 'La visión vale cuando llega antes de la jugada, observa una amenaza relevante y alguien puede actuar con ella.'],
      ['combat', 'Guardarlo para revelar un arbusto cuando la pelea ya se haya iniciado', 'DEFENSIBLE', 0.4, 'Puede resolver una necesidad puntual, pero llega tarde para elegir ruta, presión o aceptación de la pelea.'],
    ],
    principle: 'Un ward vale por la decisión que permite tomar, no por lo profundo que esté.', knowledgeKeys: ['vision', 'map_information'],
  }),
  question({
    slug: 'tempo-window', competencyKey: 'macro', level: 3,
    prompt: 'Completas un pico de poder, un rival vuelve a base y tienes prioridad central. ¿Cómo aprovechas la ventana?',
    context: 'La ventaja dura hasta que el rival regrese y convierta también sus recursos.',
    options: [
      ['force', 'Forzar una pelea inmediatamente para no desperdiciar el objeto completado', 'DEFENSIBLE', 0.45, 'El pico invita a actuar, pero forzar sin condiciones puede convertir una ventana buena en una pelea mala.'],
      ['create', 'Crear visión o presión primero y aceptar sólo la jugada que tenga condiciones', 'ADEQUATE', 1, 'Usa compra, ausencia y prioridad para actuar antes sin confundir iniciativa con obligación de pelear.'],
      ['farm', 'Farmear recursos propios hasta que el rival vuelva y se igualen los tiempos', 'RISKY', 0.25, 'Aumenta economía, pero renuncia precisamente al intervalo en el que el rival no puede responder igual.'],
    ],
    principle: 'Tempo es poder actuar antes de que el rival pueda responder en las mismas condiciones.', knowledgeKeys: ['tempo', 'priority'],
  }),
  question({
    slug: 'combat-threat-tracking', competencyKey: 'micro_concepts', level: 2,
    prompt: 'La habilidad rival que puede alcanzarte sigue disponible al empezar la pelea. ¿Qué cambia en tu colocación?',
    context: 'Puedes aportar desde un rango seguro, aunque avanzar te permitiría golpear a un objetivo más valioso.',
    options: [
      ['advance', 'Avanzar hacia el objetivo valioso y confiar en reaccionar cuando use la entrada', 'RISKY', 0.2, 'Entrar en su condición preferida obliga a ganar una reacción difícil y puede eliminar tu aportación completa.'],
      ['range', 'Aportar desde alcance útil y ampliar espacio cuando la amenaza se haya gastado', 'ADEQUATE', 1, 'Relaciona posición con herramientas disponibles; el límite seguro cambia durante la propia pelea.'],
      ['wait', 'Salir por completo de la pelea hasta que se hayan usado todas las habilidades', 'DEFENSIBLE', 0.4, 'Esperar una amenaza crítica puede ser correcto, pero desaparecer elimina daño o utilidad que aún eran seguros.'],
    ],
    principle: 'La distancia segura cambia según las herramientas que cada rival todavía conserva.', knowledgeKeys: ['combat', 'threats', 'spacing'],
  }),
  question({
    slug: 'combat-target-selection', competencyKey: 'micro_concepts', level: 3,
    prompt: 'En una pelea hay un tanque cercano y un objetivo frágil detrás de control rival. ¿Cómo eliges a quién golpear?',
    context: 'Llegar al objetivo frágil exige cruzar una zona donde pueden controlarte y eliminarte.',
    options: [
      ['fragile', 'Buscar al objetivo frágil porque eliminar daño rival decide más la pelea', 'DEFENSIBLE', 0.4, 'Su valor es alto, pero sólo si existe acceso real; morir intentando alcanzarlo elimina toda aportación posterior.'],
      ['available', 'Dañar al objetivo alcanzable y cambiar cuando se abra una ruta segura', 'ADEQUATE', 1, 'Combina valor del objetivo, acceso, riesgo y continuidad en vez de aplicar una prioridad fija.'],
      ['tank', 'Mantener el daño sobre el tanque para conservar una posición estable', 'RISKY', 0.25, 'Puede ser correcto ahora, pero convertirlo en regla impide castigar objetivos mejores cuando cambia el acceso.'],
    ],
    principle: 'La prioridad de objetivo combina valor, alcance, amenaza y posibilidad de seguir aportando.', knowledgeKeys: ['combat', 'target_selection'],
  }),
  question({
    slug: 'build-core-adaptation', competencyKey: 'builds', level: 2,
    prompt: 'Tu héroe necesita su siguiente pico, pero un rival concreto ya condiciona las peleas. ¿Cómo ajustas la build?',
    context: 'La amenaza es repetida, aunque todavía necesitas estadísticas para cumplir tu función principal.',
    options: [
      ['counter-all', 'Cambiar el núcleo completo por respuestas contra las amenazas rivales', 'RISKY', 0.2, 'Responder a todo diluye la función propia y puede dejar una colección de counters sin una condición clara.'],
      ['balance', 'Mantener la función y adelantar una respuesta si cambia la próxima pelea', 'ADEQUATE', 1, 'Compara el pico propio con el impacto inmediato de la amenaza y adapta sólo lo que resuelve el problema real.'],
      ['fixed', 'Completar el orden base y adaptar después de asegurar los picos previstos', 'DEFENSIBLE', 0.4, 'El núcleo da coherencia, pero seguirlo sin contexto puede hacer que la respuesta llegue después de la ventana decisiva.'],
    ],
    principle: 'Una build conserva la función del héroe mientras responde al problema que decide la partida.', knowledgeKeys: ['build_adaptation', 'power_spikes'],
  }),
  question({
    slug: 'build-defensive-source', competencyKey: 'builds', level: 3,
    prompt: 'El resumen muestra daño mixto, pero un único rival con ventaja te elimina al entrar. ¿Qué defensa priorizas?',
    context: 'No todas las fuentes del daño total tienen la misma capacidad de alcanzarte o decidir la pelea.',
    options: [
      ['percentage', 'Cubrir el tipo de daño con el porcentaje total más alto del equipo rival', 'DEFENSIBLE', 0.45, 'El reparto orienta, pero mezcla poke recuperable y fuentes que quizá nunca amenacen tu función.'],
      ['sequence', 'Responder a la secuencia decisiva, su daño y la forma en que te alcanza', 'ADEQUATE', 1, 'La compra busca sobrevivir al patrón que realmente te impide aportar, no a un promedio sin contexto.'],
      ['health', 'Comprar vida para repartir de forma uniforme la defensa frente al daño mixto', 'DEFENSIBLE', 0.4, 'La vida puede ayudar, pero no siempre responde a daño porcentual, penetración o una fuente especialmente adelantada.'],
    ],
    principle: 'La defensa correcta responde a una amenaza alcanzable y repetida, no sólo al daño agregado.', knowledgeKeys: ['damage_defence', 'build_adaptation'],
  }),
  question({
    slug: 'loadout-synergy', competencyKey: 'builds', level: 3,
    prompt: '¿Cómo eliges Eterno, bendiciones y Augmento antes de una partida?',
    context: 'Dos opciones populares tienen buenos resultados globales, pero potencian patrones distintos del mismo héroe.',
    options: [
      ['popular', 'Usar la combinación con mejor tasa global y mantenerla en todos los matchups', 'DEFENSIBLE', 0.4, 'La estadística es una referencia útil, pero no explica función, estilo, composición ni sesgo de muestra.'],
      ['coherent', 'Elegir una condición coherente con mi función y comprobar que puedo activarla', 'ADEQUATE', 1, 'Relaciona el efecto con habilidades, frecuencia de activación, plan de pelea y coste de renunciar a la alternativa.'],
      ['counter', 'Elegir cada pieza sólo para contrarrestar al rival directo de mi línea', 'RISKY', 0.25, 'El matchup importa, pero un loadout fragmentado puede perder sinergia y valor durante el resto de la partida.'],
    ],
    principle: 'Un loadout es bueno cuando su condición se activa de forma fiable y refuerza el plan del héroe.', knowledgeKeys: ['eternals', 'blessings', 'augments'],
  }),
  question({
    slug: 'pool-coverage', competencyKey: 'champion_pool', level: 2,
    prompt: 'Tu héroe principal funciona bien, pero no cubre una necesidad habitual de tu rol. ¿Cómo eliges una alternativa?',
    context: 'Quieres ampliar tus respuestas sin repartir la práctica entre demasiados héroes.',
    options: [
      ['similar', 'Elegir un héroe parecido aunque repita las mismas fortalezas y debilidades', 'DEFENSIBLE', 0.45, 'La transferencia mecánica acelera el aprendizaje, pero añade poca cobertura si repite el mismo problema.'],
      ['coverage', 'Elegir uno que cubra esa función y que pueda practicar con frecuencia', 'ADEQUATE', 1, 'Amplía respuestas estratégicas sin sacrificar la profundidad necesaria para desarrollar automatismos.'],
      ['meta', 'Cambiar de alternativa cada parche según la mejor tasa de victoria disponible', 'RISKY', 0.2, 'El meta aporta contexto, pero perseguirlo sin dominio crea un pool ancho y poco transferible.'],
    ],
    principle: 'Un pool pequeño, practicable y complementario desarrolla más recursos que una colección cambiante.', knowledgeKeys: ['champion_pool', 'role'],
  }),
  question({
    slug: 'review-causality', competencyKey: 'review_autonomy', level: 2,
    prompt: 'El timeline detecta una muerte 40 segundos antes de Orb Prime. ¿Qué puedes concluir sin ver el replay?',
    context: 'Conoces el momento y su impacto posterior, pero no el movimiento continuo ni la información disponible.',
    options: [
      ['position', 'Que fue un error de posición porque debilitó la preparación del objetivo', 'RISKY', 0.2, 'El impacto es visible, pero no demuestra la causa ni si la acción respondía a otra necesidad válida.'],
      ['window', 'Que es una ventana relevante para revisar visión, recursos e intención', 'ADEQUATE', 1, 'Separa el hecho medible de la hipótesis y utiliza el vídeo para confirmar la causa.'],
      ['nothing', 'Que no aporta nada porque los eventos no muestran el movimiento previo', 'RISKY', 0.15, 'La limitación no vuelve inútil el dato; señala exactamente dónde hace falta abrir el replay.'],
    ],
    principle: 'El timeline localiza una consecuencia; el replay permite investigar su causa.', knowledgeKeys: ['replay', 'causality', 'objectives'],
  }),
  question({
    slug: 'review-experiment', competencyKey: 'review_autonomy', level: 3,
    prompt: 'Tras revisar tres muertes parecidas, ¿qué conclusión te ayuda más a mejorar?',
    context: 'En las tres entraste sin ver una amenaza, pero las jugadas y los héroes no eran idénticos.',
    options: [
      ['label', 'Mi posición es el problema y retrasaré mucho más todas mis entradas', 'RISKY', 0.15, 'La etiqueta es amplia, difícil de observar y puede eliminar agresividad correcta junto al error.'],
      ['rule', 'Antes de avanzar, identificaré la amenaza y comprobaré qué información tengo', 'ADEQUATE', 1, 'Convierte el patrón en una señal observable que puede probarse en varias partidas sin imponer una receta fija.'],
      ['hero', 'Evitaré ese héroe hasta que deje de morir en situaciones semejantes', 'DEFENSIBLE', 0.35, 'Puede reducir el problema temporalmente, pero no demuestra que la causa sea el héroe ni crea aprendizaje transferible.'],
    ],
    principle: 'Una revisión útil termina en una hipótesis observable y transferible, no en una etiqueta personal.', knowledgeKeys: ['replay', 'deliberate_practice'],
  }),
];

const roleQuestions: LearningQuestion[] = [
  // Support
  question({ slug: 'support-lane-resources', competencyKey: 'role_knowledge', level: 1, roles: ['SUPPORT'], prompt: 'Tu Carry puede asegurar la oleada y el rival no ofrece una ventana clara. ¿Qué priorizas como Support?', context: 'Gastar habilidades sobre los súbditos aceleraría la oleada, pero también consumiría recursos y cambiaría su estado.', options: [
    ['push', 'Ayudar a limpiar para obtener prioridad y liberar antes la línea', 'DEFENSIBLE', 0.4, 'Empujar puede ser correcto con un propósito, pero hacerlo siempre altera recursos y puede perjudicar el plan del Carry.'],
    ['intent', 'Conservar recursos y tocar la oleada sólo cuando el plan requiera cambiarla', 'ADEQUATE', 1, 'Respeta la economía del Carry y conecta cada intervención con una intención de nivel, base, placa o rotación.'],
    ['trade', 'Buscar un intercambio aunque no exista una ventana para crear presión', 'RISKY', 0.2, 'Forzar sin ventaja de alcance, recursos o habilidades puede entregar vida y control de línea.'],
  ], principle: 'Support influye en la oleada y los intercambios sin apropiarse de los recursos del Carry.', knowledgeKeys: ['support_role', 'lane'], }),
  question({ slug: 'support-roam-window', competencyKey: 'role_knowledge', level: 2, roles: ['SUPPORT'], prompt: 'Quieres rotar desde la duolane. ¿Qué condición hace más segura la salida?', context: 'Tu Carry quedará solo durante un tiempo y el rival puede cambiar el estado de la oleada.', options: [
    ['after-recall', 'Salir después de una base conjunta aunque la oleada regrese hacia el rival', 'DEFENSIBLE', 0.4, 'La base sincroniza tiempos, pero el estado posterior aún puede dejar al Carry expuesto o perdiendo recursos.'],
    ['window', 'Salir cuando la oleada y amenazas permitan al Carry mantenerse o retirarse', 'ADEQUATE', 1, 'La rotación compara el valor fuera de línea con el riesgo y los recursos que deja atrás.'],
    ['surprise', 'Salir en cuanto el rival pierda visión para que no pueda seguir el movimiento', 'RISKY', 0.25, 'Ocultar la salida ayuda, pero no sustituye revisar oleada, seguridad del Carry y destino con valor real.'],
  ], principle: 'Una buena rotación de Support crea valor sin abandonar una crisis previsible en duolane.', knowledgeKeys: ['support_role', 'rotations', 'waves'], }),
  question({ slug: 'support-peel-engage', competencyKey: 'role_knowledge', level: 3, roles: ['SUPPORT'], prompt: 'Tu Carry va por delante y el asesino rival conserva su entrada. ¿Cómo usas tu control principal?', context: 'Puedes iniciar sobre la primera línea o reservar la herramienta para interrumpir el salto rival.', options: [
    ['engage', 'Encadenarlo con la iniciación aliada para asegurar daño sobre el frente', 'DEFENSIBLE', 0.45, 'Puede cerrar una baja, pero deja libre la herramienta que amenaza a la condición de victoria.'],
    ['peel', 'Mantener rango de protección y gastarlo cuando la entrada rival sea real', 'ADEQUATE', 1, 'Protege la fuente de ventaja mientras la amenaza siga disponible; después puede cambiar la prioridad.'],
    ['scout', 'Avanzar para localizar al asesino antes de que alcance una ruta de entrada', 'RISKY', 0.2, 'La información importa, pero exponerse puede retirar precisamente la respuesta defensiva necesaria.'],
  ], principle: 'Support alterna iniciar, proteger y negar espacio según amenazas y condición de victoria.', knowledgeKeys: ['support_role', 'combat'], }),
  question({ slug: 'support-objective-setup', competencyKey: 'role_knowledge', level: 2, roles: ['SUPPORT'], prompt: 'Tu equipo llega primero a Fangtooth. ¿Qué aporta más antes de empezarlo?', context: 'No ves a dos rivales y tu Jungla todavía está terminando una compra.', options: [
    ['start', 'Comenzar el objetivo para obligar al rival a entrar en vuestra zona', 'RISKY', 0.25, 'Sin información ni herramienta de asegurar presente, empezar puede entregar daño gratuito y una entrada favorable.'],
    ['access', 'Preparar accesos seguros, visión útil y una ruta de salida para el equipo', 'ADEQUATE', 1, 'Convierte la llegada temprana en información y espacio sin comprometer el objetivo antes de tiempo.'],
    ['hide', 'Ocultarme en una ruta lejana para sorprender al primer rival que aparezca', 'DEFENSIBLE', 0.4, 'Una emboscada puede funcionar, pero separarse demasiado reduce protección e información sobre otros accesos.'],
  ], principle: 'Support convierte tiempo previo en visión, espacio y opciones para el objetivo.', knowledgeKeys: ['support_role', 'objectives', 'vision'], }),
  question({ slug: 'support-build-function', competencyKey: 'role_knowledge', level: 3, roles: ['SUPPORT'], prompt: 'El rival tiene curación relevante y tu equipo necesita además que protejas al Carry. ¿Cómo decides la compra?', context: 'Tú aplicas efectos con frecuencia, pero retrasar utilidad defensiva también tiene un coste.', options: [
    ['antiheal', 'Comprar anti-curación inmediatamente porque responder al rival es prioritario', 'DEFENSIBLE', 0.45, 'Puede ser la respuesta, pero falta comparar aplicación, urgencia y si otro aliado la aporta con menor coste.'],
    ['compare', 'Comparar quién la aplica mejor y qué necesidad decide la próxima pelea', 'ADEQUATE', 1, 'Evalúa portador, momento y coste de oportunidad en lugar de convertir anti-curación en obligación automática.'],
    ['defence', 'Completar protección primero porque la build de Support debe centrarse en aliados', 'RISKY', 0.25, 'Proteger es parte del rol, pero ignorar una recuperación decisiva puede hacer inútil el resto de utilidad.'],
  ], principle: 'La build de Support distribuye utilidad donde el equipo puede aplicarla con mayor fiabilidad.', knowledgeKeys: ['support_role', 'build_adaptation', 'anti_heal'], }),
  question({ slug: 'support-teamfight-position', competencyKey: 'role_knowledge', level: 3, roles: ['SUPPORT'], prompt: 'Tu iniciador entra y tu Carry queda fuera de tu alcance. ¿Qué referencia debe guiar tu posición?', context: 'El rival conserva una amenaza de flanco y tu herramienta defensiva todavía está disponible.', options: [
    ['front', 'Seguir al iniciador para maximizar la cadena de control sobre su objetivo', 'DEFENSIBLE', 0.4, 'Puede aumentar la iniciación, pero rompe la distancia con quien necesita la respuesta que conservas.'],
    ['function', 'Mantener alcance sobre la función que debo proteger y vigilar el flanco', 'ADEQUATE', 1, 'La posición se organiza alrededor de la herramienta disponible y la condición de victoria actual.'],
    ['carry', 'Permanecer pegado al Carry durante toda la pelea sin atender al resto', 'RISKY', 0.25, 'Proteger no significa duplicar cada movimiento; puede impedir controlar espacio o ayudar en una ventana segura.'],
  ], principle: 'La posición de Support depende de a quién debe habilitar y qué amenaza debe negar.', knowledgeKeys: ['support_role', 'combat', 'spacing'], }),

  // Carry
  question({ slug: 'carry-lane-priority', competencyKey: 'role_knowledge', level: 1, roles: ['CARRY'], prompt: 'El rival amenaza un intercambio mientras dos súbditos están a punto de morir. ¿Cómo decides como Carry?', context: 'Responder al daño puede hacerte perder oro, pero ignorarlo por completo puede costarte demasiada vida.', options: [
    ['trade', 'Responder al rival para impedir que controle la línea sin pagar un coste', 'DEFENSIBLE', 0.4, 'La presión importa, pero responder automáticamente puede sacrificar economía en un intercambio que no ganas.'],
    ['compare', 'Valorar el oro, el daño esperado y si puedo responder sin perder ambos', 'ADEQUATE', 1, 'Conecta economía y salud; a veces asegura el súbdito, otras evita daño o castiga durante una animación rival.'],
    ['farm', 'Asegurar ambos súbditos y aceptar el daño para mantener la economía', 'RISKY', 0.2, 'El oro sostiene al Carry, pero aceptar daño gratuito puede forzar una base y perder más recursos después.'],
  ], principle: 'Carry equilibra economía y salud para llegar a sus picos sin regalar control de línea.', knowledgeKeys: ['carry_role', 'lane', 'economy'], }),
  question({ slug: 'carry-recall-wave', competencyKey: 'role_knowledge', level: 2, roles: ['CARRY'], prompt: 'Tienes una compra importante, pero la oleada está regresando hacia ti. ¿Qué pesa más al decidir la base?', context: 'Empujar sin seguridad puede exponerte, y volver ya puede permitir que el rival cambie la oleada.', options: [
    ['push', 'Empujar hasta torre aunque no vea al Jungla para fijar la oleada', 'RISKY', 0.2, 'Una buena oleada no compensa siempre una muerte o la pérdida del tempo de compra.'],
    ['cost', 'Comparar seguridad, próxima oleada y tiempo para volver con la compra', 'ADEQUATE', 1, 'La base correcta minimiza recursos perdidos sin convertir la preparación perfecta en una exposición excesiva.'],
    ['recall', 'Volver de inmediato y aceptar una oleada peor para asegurar el pico de objeto', 'DEFENSIBLE', 0.4, 'El pico puede justificarlo, pero ignorar el estado permite al rival negar más recursos de los necesarios.'],
  ], principle: 'La base de Carry coordina compra, seguridad y oleada para maximizar tiempo con poder útil.', knowledgeKeys: ['carry_role', 'waves', 'tempo'], }),
  question({ slug: 'carry-safe-damage', competencyKey: 'role_knowledge', level: 2, roles: ['CARRY'], prompt: 'Un tanque está a tu alcance y la retaguardia rival queda detrás de control disponible. ¿Qué priorizas?', context: 'Puedes mantener daño continuo sobre el frente; cruzar te acerca al Carry enemigo pero te expone.', options: [
    ['backline', 'Cruzar con el iniciador para eliminar antes a la fuente de daño rival', 'RISKY', 0.2, 'El objetivo es valioso, pero el acceso inseguro puede retirar todo tu daño de la pelea.'],
    ['available', 'Dañar desde alcance seguro y avanzar cuando cambien las amenazas', 'ADEQUATE', 1, 'Mantiene continuidad y permite mejorar objetivo cuando el rival gasta control o se abre una ruta.'],
    ['wait', 'Esperar sin atacar hasta que la retaguardia rival quede a mi alcance', 'DEFENSIBLE', 0.35, 'Protege la posición, pero renuncia a daño seguro que puede desgastar o forzar herramientas.'],
  ], principle: 'Carry maximiza daño sostenible sobre el mejor objetivo que pueda alcanzar sin regalarse.', knowledgeKeys: ['carry_role', 'combat', 'target_selection'], }),
  question({ slug: 'carry-flank-threat', competencyKey: 'role_knowledge', level: 3, roles: ['CARRY'], prompt: 'No ves al asesino rival cuando empieza una pelea frontal. ¿Cómo afecta eso a tu entrada?', context: 'Tu equipo ya intercambia daño, pero el rival conserva una ruta lateral sin visión.', options: [
    ['join', 'Entrar rápido para aportar antes de que el frente aliado pierda demasiada vida', 'DEFENSIBLE', 0.4, 'Aportar pronto importa, pero ocupar una ruta vulnerable puede dar al asesino su acceso preferido.'],
    ['limit', 'Aportar desde una ruta protegida y ampliar espacio al localizar la amenaza', 'ADEQUATE', 1, 'No exige desaparecer: adapta ángulo y alcance hasta que la información cambie.'],
    ['hide', 'Mantenerme totalmente fuera hasta que el asesino aparezca sobre otro aliado', 'RISKY', 0.25, 'Evita el primer riesgo, pero puede dejar al equipo sin su fuente principal de daño durante demasiado tiempo.'],
  ], principle: 'La información ausente también condiciona la posición de Carry.', knowledgeKeys: ['carry_role', 'vision', 'spacing'], }),
  question({ slug: 'carry-build-targets', competencyKey: 'role_knowledge', level: 3, roles: ['CARRY'], prompt: 'Dos frontales rivales acumulan defensas y sobreviven a tus ciclos de daño. ¿Qué revisas antes de comprar?', context: 'Tu build base ofrece daño, pero la próxima pelea volverá a obligarte a golpear objetivos resistentes.', options: [
    ['more-power', 'Añadir más poder plano para elevar el daño general de cada ataque', 'DEFENSIBLE', 0.4, 'Puede mejorar el total, pero su eficiencia cambia frente a defensas, vida y patrón de ataques.'],
    ['response', 'Comparar sus defensas con penetración, daño sostenido y mi forma de aplicarlo', 'ADEQUATE', 1, 'Relaciona la estadística rival con el tipo de respuesta que tu héroe puede aprovechar de manera constante.'],
    ['defence', 'Comprar supervivencia para disponer de más tiempo y compensar el daño menor', 'RISKY', 0.25, 'Sobrevivir ayuda si mueres pronto, pero no resuelve por sí solo que los objetivos obligatorios ignoren tu daño.'],
  ], principle: 'La build de Carry responde a los objetivos que realmente deberá golpear durante la pelea.', knowledgeKeys: ['carry_role', 'build_adaptation', 'damage_defence'], }),
  question({ slug: 'carry-late-map', competencyKey: 'role_knowledge', level: 3, roles: ['CARRY'], prompt: 'En juego tardío aparece una oleada lateral grande poco antes de Prime. ¿Cómo obtienes ese recurso?', context: 'Eres una fuente principal de daño del objetivo y desplazarte solo puede exponerte a una captura.', options: [
    ['take-all', 'Ir solo y limpiar todo porque el equipo necesita que mantenga mi economía', 'RISKY', 0.2, 'El recurso es valioso, pero una muerte o llegada tardía puede decidir la partida.'],
    ['coordinate', 'Coordinar quién la recoge y limitarme al tiempo y ruta que sigan siendo seguros', 'ADEQUATE', 1, 'Protege economía sin separar la condición de daño del equipo en la ventana decisiva.'],
    ['ignore', 'Ceder la oleada y agruparme desde ya para no arriesgar una llegada tardía', 'DEFENSIBLE', 0.35, 'Agruparse reduce riesgo, pero ceder recursos y presión sin valorar tiempos también puede empeorar la disputa.'],
  ], principle: 'En juego tardío, el Carry obtiene recursos sin convertirse en la captura que abre el objetivo.', knowledgeKeys: ['carry_role', 'macro', 'objectives'], }),

  // Jungle
  question({ slug: 'jungle-first-plan', competencyKey: 'role_knowledge', level: 1, roles: ['JUNGLE'], prompt: 'Antes de empezar la ruta, ¿qué información hace que el plan sea útil?', context: 'Todavía no sabes cómo se comportarán las líneas, pero sí sus controles, rangos y estados probables.', options: [
    ['fixed', 'Elegir el recorrido más rápido y mantenerlo para no perder eficiencia', 'DEFENSIBLE', 0.4, 'La eficiencia importa, pero un plan rígido ignora estados de línea e información nueva.'],
    ['conditions', 'Identificar recursos, líneas con condiciones y puntos donde reevaluaré', 'ADEQUATE', 1, 'Crea una intención económica y ventanas de revisión sin fingir que puede predecirse todo.'],
    ['gank', 'Empezar hacia la línea más débil para ayudarla antes de que quede atrás', 'RISKY', 0.2, 'Una línea débil no es necesariamente una buena ventana y puede convertir ayuda en tiempo perdido.'],
  ], principle: 'El pathing empieza con un plan, pero necesita puntos de reevaluación.', knowledgeKeys: ['jungle_role', 'pathing'], }),
  question({ slug: 'jungle-gank-quality', competencyKey: 'role_knowledge', level: 2, roles: ['JUNGLE'], prompt: '¿Qué convierte una línea cercana en una buena oportunidad de gank?', context: 'El rival está avanzado, pero tu aliado tiene poca vida y su control principal está en enfriamiento.', options: [
    ['position', 'La posición avanzada basta porque el rival tiene más distancia hasta su torre', 'DEFENSIBLE', 0.4, 'La distancia ayuda, pero no garantiza daño, control, seguimiento ni supervivencia aliada.'],
    ['resources', 'Acceso, recursos, seguimiento aliado, salida rival y coste de desviar la ruta', 'ADEQUATE', 1, 'Evalúa tanto la probabilidad y valor de éxito como lo que se deja de farmear o preparar.'],
    ['skip', 'Descartarla porque la poca vida del aliado ofrece muy poco seguimiento', 'RISKY', 0.2, 'La vida reduce opciones, pero una entrada corta o un contraataque todavía pueden ser válidos.'],
  ], principle: 'Un gank se valora por condiciones, recompensa probable y coste de oportunidad.', knowledgeKeys: ['jungle_role', 'ganks', 'tempo'], }),
  question({ slug: 'jungle-objective-route', competencyKey: 'role_knowledge', level: 2, roles: ['JUNGLE'], prompt: 'Faltan 70 segundos para un objetivo y tus campamentos reaparecen en ese lado. ¿Cómo ajustas la ruta?', context: 'La línea cercana no tiene prioridad y el Jungla rival ha sido visto en el lado opuesto.', options: [
    ['force-lane', 'Forzar la línea cercana primero para crear la prioridad que falta', 'RISKY', 0.25, 'Intentar fabricar prioridad sin condiciones puede retrasar recursos y preparación sin conseguirla.'],
    ['path', 'Limpiar hacia el objetivo y reevaluar la línea con la información nueva', 'ADEQUATE', 1, 'Conecta economía, ubicación futura y capacidad de adaptar el plan si aparece una ventana.'],
    ['full-clear', 'Completar toda la jungla aunque termine en el lado contrario al objetivo', 'DEFENSIBLE', 0.35, 'Protege economía, pero paga después un desplazamiento en una ventana conocida.'],
  ], principle: 'La ruta de Jungla alinea recursos, posición futura y siguiente objetivo probable.', knowledgeKeys: ['jungle_role', 'pathing', 'objectives'], }),
  question({ slug: 'jungle-invade', competencyKey: 'role_knowledge', level: 3, roles: ['JUNGLE'], prompt: 'Ves al Jungla rival en el lado opuesto y consideras invadir. ¿Qué compruebas?', context: 'Hay campamentos probables, pero las líneas cercanas pueden moverse antes que las tuyas.', options: [
    ['camps', 'Entrar porque el Jungla lejano reduce mucho el riesgo sobre sus campamentos', 'RISKY', 0.2, 'Localizar al Jungla elimina una amenaza, no las rotaciones, tiempos de campamento ni rutas de salida.'],
    ['priority', 'Valor del recurso, prioridad cercana, tiempo disponible y salida prevista', 'ADEQUATE', 1, 'La invasión es una inversión de tiempo y posición que necesita apoyo o una retirada viable.'],
    ['avoid', 'Asegurar mi ruta propia para conservar economía sin depender de prioridad', 'DEFENSIBLE', 0.4, 'La seguridad protege economía, pero puede regalar respuestas claras a la información obtenida.'],
  ], principle: 'Invadir requiere información sobre el mapa, no sólo sobre el Jungla enemigo.', knowledgeKeys: ['jungle_role', 'invade', 'priority'], }),
  question({ slug: 'jungle-after-gank', competencyKey: 'role_knowledge', level: 3, roles: ['JUNGLE'], prompt: 'Consigues una baja en línea. ¿Cómo eliges la conversión siguiente?', context: 'Puedes ayudar a empujar, tomar un recurso cercano, volver a base o continuar la ruta.', options: [
    ['push', 'Ayudar a empujar la oleada para que el rival pierda esos recursos bajo torre', 'RISKY', 0.2, 'Cambiar la oleada sin acuerdo puede perjudicar la base o el estado que necesita tu aliado.'],
    ['state', 'Comparar oleada, recursos, objetivo próximo, vida y compra disponible', 'ADEQUATE', 1, 'La baja crea tiempo; la mejor conversión depende de qué recurso puede asegurarse sin regalar el siguiente turno.'],
    ['farm', 'Volver a mi ruta inmediatamente para mantener campamentos y tiempos', 'DEFENSIBLE', 0.4, 'Puede ser eficiente, pero renuncia a conversiones seguras si no revisa el estado creado.'],
  ], principle: 'El valor de un gank incluye lo que se convierte durante la ausencia rival.', knowledgeKeys: ['jungle_role', 'conversion', 'waves'], }),
  question({ slug: 'jungle-behind', competencyKey: 'role_knowledge', level: 3, roles: ['JUNGLE'], prompt: 'Vas por detrás y el rival invade con prioridad de sus líneas. ¿Cuál es tu plan inicial?', context: 'Pelear cada campamento mantiene abierta la posibilidad de recuperarlo, pero el rival llega antes con apoyo.', options: [
    ['contest', 'Disputar el recurso para evitar que la diferencia de Jungla siga creciendo', 'RISKY', 0.15, 'Una disputa sin prioridad puede convertir un campamento perdido en bajas y más mapa perdido.'],
    ['trade', 'Ceder lo indefendible, tomar valor opuesto y reconstruir información y tiempos', 'ADEQUATE', 1, 'Reduce pérdidas encadenadas y busca intercambios que permitan volver a tener opciones.'],
    ['gank', 'Abandonar los campamentos y encadenar ganks hasta recuperar la diferencia', 'DEFENSIBLE', 0.35, 'Puede encontrar valor, pero forzar líneas sin condiciones arriesga perder también tiempo y experiencia.'],
  ], principle: 'Jugar desde atrás exige intercambiar recursos y evitar que una pérdida se multiplique.', knowledgeKeys: ['jungle_role', 'cross_map', 'recovery'], }),

  // Midlane
  question({ slug: 'mid-priority', competencyKey: 'role_knowledge', level: 1, roles: ['MIDLANE'], prompt: 'Empujas la línea central y no hay una jugada lateral clara. ¿Cómo usas la prioridad?', context: 'No ves al Jungla rival y todavía puedes regresar antes de la siguiente oleada.', options: [
    ['rotate', 'Entrar al río porque empujar obliga al rival a responder la oleada', 'RISKY', 0.25, 'La prioridad abre la ruta, pero no crea por sí sola información ni una jugada con valor.'],
    ['options', 'Tomar información o recurso seguro y rotar si aparece una ventana real', 'ADEQUATE', 1, 'Convierte el tiempo libre en opciones sin pagar una rotación forzada y sin destino.'],
    ['stay', 'Permanecer visible en medio hasta que llegue la siguiente oleada', 'DEFENSIBLE', 0.4, 'Reduce riesgo, pero puede desperdiciar tiempo útil para visión, río o apoyo cercano.'],
  ], principle: 'La prioridad central abre opciones; no obliga a rotar.', knowledgeKeys: ['midlane_role', 'priority', 'rotations'], }),
  question({ slug: 'mid-river-resource', competencyKey: 'role_knowledge', level: 2, roles: ['MIDLANE'], prompt: 'Aparece un recurso de río mientras tu oleada está bajo torre rival. ¿Qué decide si puedes tomarlo?', context: 'El Mid rival debe responder a la oleada, pero no tienes información completa del Jungla.', options: [
    ['take', 'Tomarlo al tener prioridad y disponer del primer turno de movimiento', 'DEFENSIBLE', 0.4, 'Llegar primero ayuda, pero no garantiza salida, visión ni que el Jungla rival esté lejos.'],
    ['check', 'Comprobar rutas, información, apoyo y tiempo antes de la siguiente oleada', 'ADEQUATE', 1, 'Usa la prioridad como ventaja de tiempo y la combina con la seguridad necesaria para convertirla.'],
    ['skip', 'Ignorarlo si no veo al Jungla rival y mantenerme en el centro del mapa', 'RISKY', 0.25, 'La cautela es válida, pero renunciar siempre elimina valor incluso cuando existen rutas y apoyo seguros.'],
  ], principle: 'Midlane convierte prioridad en recursos cuando la información permite entrar y salir.', knowledgeKeys: ['midlane_role', 'river', 'vision'], }),
  question({ slug: 'mid-missing-laner', competencyKey: 'role_knowledge', level: 2, roles: ['MIDLANE'], prompt: 'Tu rival desaparece de línea después de empujar. ¿Qué respuesta es más completa?', context: 'No sabes si ha vuelto a base, ha colocado visión o se dirige a una lateral.', options: [
    ['follow', 'Seguirlo por la ruta más corta para llegar a la misma jugada a tiempo', 'RISKY', 0.2, 'Entrar a ciegas puede convertir una alerta correcta en una emboscada y dos pérdidas.'],
    ['communicate', 'Avisar, obtener información segura y decidir entre seguir, empujar o comprar', 'ADEQUATE', 1, 'Gestiona la incertidumbre y compara respuestas en vez de asumir una única intención rival.'],
    ['push', 'Empujar para castigar su ausencia y crear presión sobre la torre central', 'DEFENSIBLE', 0.4, 'Puede convertir recursos, pero no basta si una rotación rival decisiva requiere aviso o respuesta.'],
  ], principle: 'Ante una desaparición, Midlane comunica primero y responde según información y costes.', knowledgeKeys: ['midlane_role', 'map_information', 'waves'], }),
  question({ slug: 'mid-teamfight-angle', competencyKey: 'role_knowledge', level: 3, roles: ['MIDLANE'], prompt: 'Tu héroe puede aportar daño de área, pero entrar por el frente te expone a control. ¿Qué ángulo buscas?', context: 'Existe un lateral con visión aliada, aunque separarte demasiado perdería protección.', options: [
    ['front', 'Permanecer detrás del tanque y lanzar todo sobre el primer objetivo', 'DEFENSIBLE', 0.4, 'Es estable, pero puede reducir impacto si el frente bloquea alcance o zona sobre objetivos clave.'],
    ['useful', 'Un ángulo con alcance útil, salida conocida y apoyo suficientemente cercano', 'ADEQUATE', 1, 'Mejora el acceso sin confundir un ángulo lateral con aislarse del equipo.'],
    ['deep', 'Rodear ampliamente para alcanzar desde atrás a la retaguardia rival', 'RISKY', 0.2, 'El potencial es alto, pero el tiempo y aislamiento pueden retirar tu daño o permitir una captura.'],
  ], principle: 'Un buen ángulo de Midlane aumenta impacto sin perder salida ni apoyo.', knowledgeKeys: ['midlane_role', 'combat', 'angles'], }),
  question({ slug: 'mid-build-access', competencyKey: 'role_knowledge', level: 3, roles: ['MIDLANE'], prompt: 'Tu daño teórico es alto, pero no puedes aplicarlo antes de ser alcanzado. ¿Qué revisas en la build?', context: 'El rival dispone de entrada y control; otra compra de poder completaría tu orden habitual.', options: [
    ['power', 'Completar el poder previsto porque una rotación correcta compensará el riesgo', 'DEFENSIBLE', 0.4, 'La ejecución importa, pero una build que nunca puede aplicarse puede necesitar otra herramienta.'],
    ['function', 'Comparar alcance, supervivencia o utilidad según la secuencia que me niega', 'ADEQUATE', 1, 'Busca la estadística o efecto que permite ejecutar la función, no sólo elevar el daño de laboratorio.'],
    ['defence', 'Cambiar todas las compras restantes a defensa para dejar de ser objetivo', 'RISKY', 0.2, 'Sobrevivir sin conservar una amenaza relevante también puede impedir cumplir el rol.'],
  ], principle: 'La build de Midlane debe permitir aplicar su patrón de daño o utilidad en la pelea real.', knowledgeKeys: ['midlane_role', 'build_adaptation', 'combat'], }),
  question({ slug: 'mid-side-lane', competencyKey: 'role_knowledge', level: 3, roles: ['MIDLANE'], prompt: 'Tras caer las primeras torres, una oleada lateral necesita atención. ¿Cuándo es razonable recogerla?', context: 'Tu equipo puede mantenerse seguro y no aparece un objetivo inmediato, pero el centro sigue siendo disputable.', options: [
    ['always-mid', 'Mantenerme en medio para conservar una distancia parecida hacia ambos lados', 'DEFENSIBLE', 0.4, 'La posición central ofrece acceso, pero puede concentrar recursos y dejar perder oleadas laterales.'],
    ['window', 'Recogerla con una ruta segura y regresar antes de la siguiente ventana colectiva', 'ADEQUATE', 1, 'Convierte recursos laterales sin abandonar al equipo durante el momento en que necesita presión central.'],
    ['full-side', 'Empujar hasta la siguiente torre para obligar al rival a responderme', 'RISKY', 0.25, 'La presión puede ser útil, pero profundizar sin información ni tiempo puede crear una captura.'],
  ], principle: 'Midlane puede tomar recursos laterales si conserva tiempo y ruta para volver a influir.', knowledgeKeys: ['midlane_role', 'macro', 'waves'], }),

  // Offlane
  question({ slug: 'offlane-trade-wave', competencyKey: 'role_knowledge', level: 1, roles: ['OFFLANE'], prompt: 'El rival usa una habilidad importante sobre la oleada. ¿Qué determina si puedes intercambiar?', context: 'Su herramienta queda en enfriamiento, pero varios súbditos rivales todavía pueden golpearte.', options: [
    ['cooldown', 'Entrar al quedar su habilidad en enfriamiento y aprovechar esa ventana', 'DEFENSIBLE', 0.4, 'El enfriamiento ayuda, pero vida, oleada, alcance y salida pueden volver mala la ventana.'],
    ['whole-state', 'Comparar enfriamiento, oleada, recursos, posición y duración del intercambio', 'ADEQUATE', 1, 'Usa la ventaja temporal sin ignorar el daño de súbditos ni cómo termina la secuencia.'],
    ['farm', 'No intercambiar y aprovechar que la habilidad no puede negar mis últimos golpes', 'RISKY', 0.25, 'Farmear puede ser correcto, pero renunciar siempre pierde ventanas que podrían mejorar toda la línea.'],
  ], principle: 'Offlane intercambia cuando varias ventajas coinciden, no por una señal aislada.', knowledgeKeys: ['offlane_role', 'trading', 'waves'], }),
  question({ slug: 'offlane-weakside', competencyKey: 'role_knowledge', level: 2, roles: ['OFFLANE'], prompt: 'No ves al Jungla rival y tu equipo juega en el lado opuesto. ¿Cómo gestionas la presión?', context: 'Empujar daría acceso a la torre, pero no tienes apoyo cercano ni visión profunda.', options: [
    ['pressure', 'Empujar para obligar al rival a responder y crear espacio al otro lado', 'DEFENSIBLE', 0.4, 'La presión puede ayudar, pero una muerte gratuita también libera al rival y elimina ese espacio.'],
    ['limit', 'Presionar sólo hasta el punto compatible con información y una salida real', 'ADEQUATE', 1, 'Mantiene presencia sin ofrecer al rival una captura sencilla cuando tu equipo no puede responder.'],
    ['freeze', 'Retroceder hacia torre hasta recuperar información sobre el Jungla rival', 'RISKY', 0.25, 'Reduce riesgo, pero ceder toda presión de forma automática puede perder recursos y oportunidades seguras.'],
  ], principle: 'Jugar weakside consiste en producir valor sin exigir recursos que el equipo usa en otro lugar.', knowledgeKeys: ['offlane_role', 'weakside', 'vision'], }),
  question({ slug: 'offlane-objective-rotation', competencyKey: 'role_knowledge', level: 2, roles: ['OFFLANE'], prompt: 'Faltan 45 segundos para un objetivo decisivo y tu equipo necesita primera línea. ¿Qué haces?', context: 'Puedes resolver la oleada actual y todavía llegar antes de que el rival controle la zona.', options: [
    ['tower', 'Quedarme hasta amenazar torre para obligar al rival a responder a la presión', 'DEFENSIBLE', 0.4, 'Puede forzar una respuesta, pero aquí el equipo no puede reemplazar tu función en la ventana decisiva.'],
    ['rotate', 'Resolver la oleada y moverme antes de que el rival ocupe los accesos', 'ADEQUATE', 1, 'Conserva parte de la presión y llega a tiempo para aportar la función que el equipo necesita.'],
    ['late', 'Seguir farmeando y volver a base cuando el objetivo ya esté disponible', 'RISKY', 0.2, 'Entrega al rival tiempo para visión, accesos e inicio mientras aún estás comprando o desplazándote.'],
  ], principle: 'Offlane compara el valor de la presión lateral con la función que falta en la pelea.', knowledgeKeys: ['offlane_role', 'objectives', 'tempo'], }),
  question({ slug: 'offlane-teamfight-entry', competencyKey: 'role_knowledge', level: 3, roles: ['OFFLANE'], prompt: 'Tu héroe puede iniciar, pero el equipo rival espera agrupado y conserva control. ¿Cómo eliges la entrada?', context: 'Existe un ángulo lateral posible, aunque tu equipo todavía necesita tiempo para ponerse a alcance.', options: [
    ['instant', 'Entrar al primer objetivo disponible antes de que el rival cambie de posición', 'RISKY', 0.2, 'Iniciar sin alcance aliado convierte una buena herramienta en aislamiento y daño sin seguimiento.'],
    ['sync', 'Alinear ángulo, seguimiento aliado, objetivo y herramientas rivales disponibles', 'ADEQUATE', 1, 'La entrada vale por lo que habilita y por la capacidad del equipo de convertirla.'],
    ['front', 'Mantener el frente y esperar que el rival comprometa primero sus herramientas', 'DEFENSIBLE', 0.4, 'Puede proteger espacio, pero renuncia a ventanas en las que tu iniciación tendría mejores condiciones.'],
  ], principle: 'La iniciación de Offlane necesita seguimiento, objetivo y una salida o intercambio aceptable.', knowledgeKeys: ['offlane_role', 'engage', 'combat'], }),
  question({ slug: 'offlane-build-function', competencyKey: 'role_knowledge', level: 3, roles: ['OFFLANE'], prompt: 'Vas por delante en línea, pero tu equipo no tiene quien absorba la entrada rival. ¿Cómo orientas la build?', context: 'Más daño ampliaría tu ventaja individual; más resistencia permitiría ocupar espacio en las peleas.', options: [
    ['damage', 'Aumentar daño para convertir la ventaja en bajas antes de necesitar defensa', 'DEFENSIBLE', 0.45, 'Puede acelerar la partida, pero no garantiza que el equipo pueda entrar o sobrevivir a la respuesta rival.'],
    ['team-need', 'Conservar amenaza y añadir la resistencia necesaria para cumplir esa función', 'ADEQUATE', 1, 'Transforma la ventaja de línea en una herramienta que resuelve una carencia colectiva sin anular tu presión.'],
    ['tank', 'Cambiar todo a resistencia porque la composición necesita una primera línea', 'RISKY', 0.25, 'Cubrir la función importa, pero abandonar toda amenaza puede permitir que el rival te ignore.'],
  ], principle: 'La build de Offlane convierte ventaja personal en la función que necesita la composición.', knowledgeKeys: ['offlane_role', 'build_adaptation', 'team_composition'], }),
  question({ slug: 'offlane-side-pressure', competencyKey: 'role_knowledge', level: 3, roles: ['OFFLANE'], prompt: 'Presionas una lateral y desaparecen varios rivales. ¿Qué información decide si continúas?', context: 'Tu equipo obtiene espacio en el otro lado, pero no puede ayudarte si te cierran las salidas.', options: [
    ['continue', 'Seguir porque atraer varios rivales ya cumple el objetivo de la presión', 'DEFENSIBLE', 0.4, 'Atraer recursos tiene valor, pero morir puede regalar más tiempo y objetivo del que el equipo obtiene.'],
    ['exit', 'Medir posiciones, rutas de salida y qué puede convertir el equipo mientras cedo espacio', 'ADEQUATE', 1, 'La presión lateral vale por el intercambio global y por retirarse antes de que la amenaza supere el beneficio.'],
    ['group', 'Abandonar la lateral en cuanto falte un rival y reagruparme de inmediato', 'RISKY', 0.25, 'Reduce capturas, pero renunciar siempre elimina presión incluso cuando hay información o salida suficiente.'],
  ], principle: 'La presión lateral es buena si fuerza una respuesta y el intercambio global sigue siendo favorable.', knowledgeKeys: ['offlane_role', 'split_pressure', 'map_information'], }),
];

export const PLACEMENT_QUESTIONS_V3: LearningQuestion[] = [...generalQuestions, ...roleQuestions];
