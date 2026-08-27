# RiftLine Companion para Windows

## Estado del prototipo

El acompañante es una aplicación de escritorio separada de la web. Reutiliza la sección **Academia > Entrenamiento local**, captura exclusivamente una ventana cuyo nombre corresponda a Predecessor y muestra los consejos en una ventana transparente que ignora ratón y teclado.

Este primer hito permite probar de extremo a extremo:

1. inicio de sesión en RiftLine dentro del acompañante;
2. detección y selección de la ventana de Predecessor;
3. consentimiento explícito antes de capturar;
4. vista previa privada de la captura;
5. tarjeta superpuesta, transparente y no interactiva;
6. parada de emergencia con `Ctrl+Shift+F10`;
7. bloqueo de Ranked y modo silencioso mientras no haya dos señales automáticas coincidentes.

Todavía no se debe considerar un coach automático: los detectores visuales necesitan calibrarse con capturas reales de cada resolución y escala de interfaz. El botón de prueba sólo valida el overlay y está rotulado como prueba; no simula una decisión del coach.

## Ejecutar contra staging

Desde la raíz del repositorio en WSL:

```bash
RIFTLINE_COMPANION_URL=http://localhost:8080 npm --workspace @predecessor/companion start
```

Para que una ventana transparente pueda dibujarse encima del juego, Predecessor debe ejecutarse en modo **ventana sin bordes**. El fullscreen exclusivo puede impedir que Windows componga otras ventanas sobre el juego.

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
