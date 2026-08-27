# RiftLine Companion para Windows

## Estado del prototipo

El acompañante es una aplicación de escritorio separada de la web. Reutiliza la sección **Academia > Entrenamiento local**, captura exclusivamente una ventana cuyo nombre corresponda a Predecessor y muestra los consejos en una ventana transparente que ignora ratón y teclado. La versión privada `0.1.x` abre staging local en `http://localhost:8080`; este valor deberá cambiar a `https://riftline.app` antes de una versión pública.

Este primer hito permite probar de extremo a extremo:

1. inicio de sesión en RiftLine dentro del acompañante;
2. detección y selección de la ventana de Predecessor;
3. consentimiento explícito antes de capturar;
4. vista previa privada de la captura;
5. tarjeta superpuesta, transparente y no interactiva;
6. parada de emergencia con `Ctrl+Shift+F10`;
7. bloqueo de Ranked y modo silencioso mientras no haya dos señales automáticas coincidentes.

El primer detector ya integrado ejecuta OCR dentro del renderer aislado. Sólo envía a la API el modo normalizado, la confianza y la hora; el fotograma y el texto completo no salen del equipo. Una lectura fiable de Ranked bloquea inmediatamente. Una lectura de un modo permitido cuenta como una sola fuente y no activa consejos por sí misma.

La segunda fuente se calibra desde la propia Academia:

1. el OCR debe identificar un modo permitido con al menos 85% de confianza;
2. el usuario dibuja un recorte ajustado alrededor del rótulo visible;
3. RiftLine vuelve a ejecutar OCR únicamente sobre el recorte y exige que confirme el mismo modo;
4. se guarda localmente una firma visual normalizada, no el fotograma;
5. esa plantilla queda excluida de la sesión donde se creó;
6. en una sesión posterior debe superar 94% de similitud y coincidir con el OCR actual para habilitar el modo.

Una plantilla creada para una resolución sólo se prueba contra capturas con una relación de aspecto equivalente. Las señales contradictorias bloquean la sesión en lugar de elegir la más conveniente.

Después de verificar un modo permitido, el mismo OCR puede registrar dos señales conservadoras del HUD: una pantalla propia de reaparición y un aviso explícito de punto de habilidad disponible. Ambas se guardan únicamente para el informe posterior, con las entradas que faltan y sin puntuación ni consejo en vivo. El sistema no deduce por qué murió el jugador ni qué habilidad debía subir; esas conclusiones requieren héroe, estado de la partida y replay.

Todavía no se debe considerar un coach automático: los detectores visuales necesitan calibrarse con capturas reales de cada resolución y escala de interfaz. El botón de prueba sólo valida el overlay y está rotulado como prueba; no simula una decisión del coach.

## Ejecutar contra staging

Desde la raíz del repositorio en WSL:

```bash
RIFTLINE_COMPANION_URL=http://localhost:8080 npm --workspace @predecessor/companion start
```

Para que una ventana transparente pueda dibujarse encima del juego, Predecessor debe ejecutarse en modo **ventana sin bordes**. El fullscreen exclusivo puede impedir que Windows componga otras ventanas sobre el juego.

## Banco de prueba local

El directorio `apps/companion/test-harness` permite comprobar el puente aislado y la tarjeta real sin abrir una partida. Se sirve en local, se inicia Electron apuntando a ese origen y se ejecuta `check-cdp.mjs` contra el puerto de depuración elegido. La comprobación confirma el entorno expuesto, el filtrado de ventanas, el envío de una tarjeta y la ausencia de controles interactivos en el overlay. Este banco no se incluye en el instalador.

## Crear el instalador

El workflow **Windows Companion** compila el cliente en `windows-latest` y adjunta `RiftLine-Companion-Windows-unsigned` a la ejecución de GitHub Actions. Es un instalador privado sin firma de código; Windows SmartScreen puede advertir sobre él. Antes de cualquier distribución pública se necesita:

- certificado de firma de código;
- icono e identidad de versión definitivos;
- revisión de privacidad y términos;
- confirmación de Omeda sobre la distribución y los modos permitidos;
- validación de los detectores en hardware y resoluciones reales.

## Límites de seguridad

- No lee memoria del proceso.
- No inyecta DLLs ni código.
- No intercepta tráfico del juego.
- No pulsa teclas, mueve el ratón ni automatiza acciones.
- La página remota se ejecuta sin Node.js, con aislamiento de contexto y sandbox.
- El puente de escritorio sólo expone operaciones cerradas: detectar/seleccionar Predecessor, mostrar/ocultar una tarjeta y recibir la parada de emergencia.
- No se exponen miniaturas ni píxeles de otras ventanas a la página web.
- Cualquier duda sobre el modo mantiene el coach en silencio.

## Siguiente calibración

Para activar consejos reales hacen falta muestras propias de Predecessor en, como mínimo, 1920×1080, 2560×1440 y la resolución usada por el probador. De cada muestra se etiquetarán:

- pantalla o rótulo del modo de juego;
- HUD personal;
- marcador abierto;
- minimapa;
- tienda y orden de compra;
- estado fuera de combate;
- cronómetro y avisos de objetivos.

Las muestras deben evitar nombres, chat y cualquier dato personal que no sea necesario. Cada detector tendrá umbral de confianza, versión de plantilla y pruebas de regresión antes de poder producir una señal o recomendación.

El botón **Guardar muestra local** descarga el fotograma en el propio equipo para esta calibración. RiftLine no lo sube automáticamente y el usuario debe revisarlo antes de compartirlo.

Al detener una captura, la Academia cierra también su sesión de servidor y muestra un informe auditable: modo solicitado/detectado, estado de verificación, observaciones guardadas, intervenciones mostradas y observaciones que se reservaron para revisión. Cada marcador separa hecho, inferencia, limitación y pregunta de replay, y propone un fragmento alrededor del instante de captura. Desde el informe se puede crear una revisión, adjuntar después una grabación, alinear los tiempos y clasificar cada momento como buena decisión, decisión mejorable o no concluyente con una explicación escrita. Una captura no verificada termina como `ABORTED`, no queda pendiente ni genera evidencia observada.

Las observaciones sin una rúbrica revisada no puntúan competencias. El informe expone este impacto y una sesión de overlay nunca concede por sí sola un ascenso de nivel.

## Cobertura y calidad de detectores

La Academia no presenta una capacidad prevista como si ya estuviera disponible. El panel **Cobertura real del acompañante** distingue:

- protección del modo verificada en la sesión;
- señal de HUD capturada, que todavía debe confirmarse en el replay;
- detector disponible pero pendiente de validación con partidas reales;
- área pendiente de implementación;
- captura bloqueada por seguridad.

Cada área explica qué puede demostrar, qué no puede concluir y cuál es la siguiente validación. Inventario y orden de compra, marcador de ambos equipos y minimapa aparecen explícitamente como pendientes hasta que exista un detector real.

El sistema no publica una precisión estimada, ni porcentajes de falsos positivos o falsos negativos, mientras no haya suficientes capturas reales etiquetadas. Un evento detectado prueba que el detector produjo una señal; no prueba por sí solo que dicha señal fuera correcta.
