const debuggingOrigin = process.argv[2] ?? 'http://127.0.0.1:9223';

async function listTargets() {
  const response = await fetch(`${debuggingOrigin}/json/list`);
  if (!response.ok) throw new Error(`DevTools target list failed with ${response.status}`);
  return response.json();
}

async function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out while evaluating ${target.title}`));
    }, 10_000);
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
    });
    socket.addEventListener('error', () => reject(new Error(`Could not connect to ${target.title}`)));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error || message.result?.exceptionDetails) {
        reject(new Error(message.error?.message ?? message.result.exceptionDetails.text));
        return;
      }
      resolve(message.result?.result?.value);
    });
  });
}

const targets = await listTargets();
const controller = targets.find((target) => target.title === 'RiftLine Companion Test Harness');
const overlay = targets.find((target) => target.title === 'RiftLine Coach Overlay');
if (!controller || !overlay) throw new Error('The controller and overlay DevTools targets must both exist');

const environment = await evaluate(controller, `(async () => {
  document.querySelector('#environment').click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { bridgeAvailable: !!window.riftlineCompanion, result: JSON.parse(document.querySelector('#result').textContent) };
})()`);
const scan = await evaluate(controller, `(async () => {
  document.querySelector('#scan').click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  return JSON.parse(document.querySelector('#result').textContent);
})()`);
const overlayRequest = await evaluate(controller, `(async () => {
  document.querySelector('#overlay').click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  return JSON.parse(document.querySelector('#result').textContent);
})()`);
const overlayState = await evaluate(overlay, `({
  text: document.body.innerText,
  hasReason: document.body.innerText.includes('puente aislado'),
  hasPrinciple: document.body.innerText.includes('no habilita coaching'),
  interactiveElements: document.querySelectorAll('button, input, select, textarea, a[href]').length,
})`);

console.log(JSON.stringify({ environment, scan, overlayRequest, overlayState }, null, 2));
