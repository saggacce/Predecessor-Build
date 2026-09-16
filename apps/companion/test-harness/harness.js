const result = document.querySelector('#result');

function write(value) {
  result.textContent = JSON.stringify(value, null, 2);
}

document.querySelector('#environment').addEventListener('click', async () => write(await window.riftlineCompanion.getEnvironment()));
document.querySelector('#scan').addEventListener('click', async () => write(await window.riftlineCompanion.scanGameWindows()));
document.querySelector('#overlay').addEventListener('click', async () => write(await window.riftlineCompanion.showAdvice({
  title: 'Prueba visual del acompañante',
  cue: 'El overlay funciona y no recibe controles.',
  reason: 'La ventana transparente ha recibido un mensaje por el puente aislado.',
  principle: 'Una prueba visual no habilita coaching ni genera evidencia.',
  priority: 'NORMAL',
  durationMs: 12_000,
})));
document.querySelector('#clear').addEventListener('click', async () => write(await window.riftlineCompanion.clearAdvice()));

write({ bridgeAvailable: !!window.riftlineCompanion });
