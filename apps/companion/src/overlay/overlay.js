const card = document.querySelector('#coach-card');
const title = document.querySelector('#title');
const cue = document.querySelector('#cue');
const reason = document.querySelector('#reason');
const principle = document.querySelector('#principle');
const priority = document.querySelector('#priority');

function showAdvice(advice) {
  title.textContent = advice.title;
  cue.textContent = advice.cue;
  reason.textContent = advice.reason;
  principle.textContent = advice.principle;
  priority.textContent = advice.priority === 'HIGH' ? 'PRIORIDAD ALTA' : '';
  card.classList.toggle('coach-card--high', advice.priority === 'HIGH');
  card.hidden = false;
}

if (window.riftlineOverlay) {
  window.riftlineOverlay.onAdvice(showAdvice);
  window.riftlineOverlay.onClear(() => { card.hidden = true; });
} else if (new URLSearchParams(window.location.search).get('preview') === '1') {
  showAdvice({
    title: 'Prepara tu próxima compra',
    cue: 'Tienes una ventana segura para volver a base antes del objetivo.',
    reason: 'La oleada está avanzada y el objetivo aún no está disponible. No se detectan señales de combate inmediato.',
    principle: 'Convierte el oro en poder antes de disputar, pero no abandones una pelea ya iniciada.',
    priority: 'NORMAL',
  });
}
