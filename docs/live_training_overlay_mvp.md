# RiftLine Companion — contrato del MVP de entrenamiento local

El cliente de escritorio y las instrucciones de prueba están documentados en [`windows_companion.md`](./windows_companion.md). Este documento define el contrato funcional y de datos; el cliente implementa la captura y presentación sin conceder al portal acceso genérico al sistema operativo.

## Objetivo

El overlay es un acompañante educativo personal para modos no competitivos de Predecessor. Observa únicamente información que el jugador puede ver, interviene pocas veces y convierte la sesión en evidencias y momentos de revisión para la Academia.

No juega por el usuario, no automatiza entradas y no afirma causas que la pantalla o el replay no demuestren.

## Modos y bloqueo obligatorio

- Permitidos para el prototipo: `STANDARD`, `QUICK`, `ARAM`, `LABS`, `PRACTICE`, `AI` y `CUSTOM`.
- Bloqueados: `RANKED`, `COMPETITIVE`, `RANKED_SOLO`, `RANKED_DUO` y cualquier alias nuevo que se identifique.
- La elección manual sólo inicia una sesión pendiente; nunca habilita consejos.
- Un modo permitido necesita dos señales automáticas fiables y de fuentes diferentes: OCR, reconocimiento de plantilla o dato estructurado autorizado.
- Una señal fiable de Ranked bloquea la sesión de forma irreversible.
- Señales contradictorias, modo desconocido o confianza insuficiente mantienen o llevan la sesión a estado bloqueado.
- No existe anulación manual del bloqueo.

Antes de distribuirlo fuera del entorno personal se necesita confirmación escrita de Omeda.

## Límites técnicos

El cliente de escritorio puede usar captura de pantalla, OCR y visión local. Quedan fuera del diseño:

- lectura o escritura de memoria del juego;
- inyección en el proceso;
- interceptación de tráfico privado;
- automatización de teclado o ratón;
- información oculta por niebla de guerra;
- uso en Ranked o competición;
- subida de vídeo sin consentimiento y política de retención.

## Detectores del MVP

| Detector | Datos mínimos | Uso durante la partida | Uso posterior |
| --- | --- | --- | --- |
| Modo | nombre, fuente, confianza, instante | habilitar o bloquear toda la sesión | auditoría de seguridad |
| Estado personal | héroe, nivel, vida, maná, oro | compra, vuelta a base, habilidad siguiente | economía y recursos |
| Inventario | objetos y componentes propios | siguiente compra y adaptación | orden y tempo de build |
| Marcador | héroes, niveles y objetos visibles de ambos equipos | amenazas, resistencias y redundancias | evolución de las diez builds |
| Habilidades | niveles actuales y punto disponible | sugerencia contextual de mejora | comparación con la situación |
| Minimap | iconos visibles, estructuras, objetivos, wards visibles | preparación, información y riesgo | reacción ante señales disponibles |
| Eventos | muerte, baja, objetivo, estructura, compra | sólo alertas prioritarias | clips y timeline de revisión |

Cada observación conserva el instante, la región de pantalla, el valor interpretado, la confianza y, cuando proceda, una referencia local a la captura. Una lectura antigua del marcador debe mostrar su antigüedad y no tratarse como estado actual.

## Política de intervención

El motor de reglas decide si una señal merece interrumpir. La IA redacta o adapta la explicación, pero no inventa el disparador.

Prioridades:

1. **Seguridad:** Ranked detectada, pérdida de verificación o captura inválida. Siempre bloquea; no ofrece consejo táctico.
2. **Decisión próxima:** ventana de compra, preparación de objetivo, punto de habilidad o adaptación funcional de build.
3. **Misión activa:** recordatorio breve relacionado con la única competencia practicada.
4. **Revisión posterior:** momento interesante con incertidumbre que debe guardarse sin interrumpir.

Reglas de experiencia:

- una sola idea por intervención;
- silencio durante combate o secuencias de alta carga;
- enfriamiento entre consejos y deduplicación por concepto;
- no emitir un consejo con confianza insuficiente;
- explicar el motivo al desplegar el aviso;
- registrar alternativas defendibles y condiciones que cambiarían la recomendación;
- permitir frecuencia mínima, equilibrada o intensiva, manteniendo los mismos límites de seguridad.

## Consejos que puede generar el MVP

### Vuelta a base

Requiere oro, compra alcanzable, estado aproximado de oleada, recursos personales, objetivo próximo e información visible de amenazas. Si falta el estado de la oleada, se registra como posible ventana y se revisa después; no se afirma que la vuelta sea correcta.

### Visión y objetivos

Requiere temporizador o anuncio fiable, ward disponible, rol, posición aproximada y estado visible del mapa. Formula preparación —comprar, empujar, reagrupar y obtener información— antes que una orden exacta de colocar un ward en una coordenada no verificada.

### Build

Combina héroe y función propios, inventario actual, composición rival, última build visible de aliados y enemigos, tipos de daño, control, curación, escudos, resistencias y siguiente objetivo. La respuesta distingue núcleo, adaptación, coste de oportunidad y quién puede aplicar mejor la herramienta dentro del equipo.

### Habilidades

Parte del orden actual y permite romper el orden base cuando una necesidad visible lo justifica: limpieza, supervivencia, movilidad, presión o respuesta al matchup. Siempre explica qué condición produjo la excepción.

### Minimap

Puede afirmar que una señal estuvo visible y medir la reacción posterior; no puede afirmar que el jugador la miró. No reconstruye posiciones ocultas ni intención. En caso de duda genera un marcador de replay con una pregunta concreta.

## Contrato de evidencia con Academia

Una observación destinada al perfil pedagógico usa este contenido mínimo:

```json
{
  "competencyKey": "macro",
  "learningScore": 0.8,
  "explanation": "La ventana de compra se detectó con oro suficiente, oleada resuelta y sin objetivo inmediato.",
  "detector": "recall_window_v1",
  "inputs": ["gold", "wave_state", "objective_timer"],
  "missingInputs": [],
  "capturedAt": "2026-08-27T18:00:00.000Z"
}
```

- `learningScore` sólo se incluye si existe una rúbrica determinista revisada.
- Una observación sin puntuación puede aparecer en el timeline, pero no cambia dominio ni habilita un ascenso.
- La confianza del detector y la confianza pedagógica son conceptos diferentes.
- Diagnóstico, misión, replay y overlay permanecen identificables como fuentes distintas.

## Informe posterior

La sesión termina en un informe con:

- prioridad principal y hasta dos secundarias;
- momentos positivos además de errores;
- timeline de compras, habilidades, muertes, objetivos y señales visibles;
- evolución propia y última información conocida de builds aliadas y rivales;
- hecho observado, inferencia, limitación y pregunta de replay;
- clips sugeridos alrededor de momentos relevantes;
- resultado de la misión activa;
- propuesta de la siguiente práctica, sin ascenso automático.

La API de partidas completa el contexto cuando existe, pero una ausencia de datos no se rellena con una explicación inventada.

## Fases de entrega

1. Cliente local, consentimiento y bloqueo de modo con dos señales.
2. Captura y timeline local sin consejos.
3. Detectores de HUD: reloj, héroe, nivel, oro, inventario, habilidades y marcador.
4. Informe posterior integrado con Academia y clips locales.
5. Consejos breves de build, habilidad, compra y objetivo en modos permitidos.
6. Minimap y medición de reacción, después de validar resoluciones, escalas, idiomas y cambios de parche.
7. Paquete de demostración para Omeda con métricas de falsos positivos, auditoría del bloqueo y límites técnicos.

El overlay no se considera listo por mostrar recomendaciones plausibles. Debe demostrar que cada consejo puede remontarse a señales visibles, conocimiento versionado, una regla revisada y un nivel de confianza suficiente.
