const inspectButton = document.querySelector('#inspect-button');
const foundButton = document.querySelector('#found-button');
const quietToggle = document.querySelector('#quiet-toggle');
const tinyButton = document.querySelector('#tiny-button');
const result = document.querySelector('#result');
const counter = document.querySelector('#counter');
const gaugeFill = document.querySelector('#gauge-fill');
const gaugeValue = document.querySelector('#gauge-value');
const toast = document.querySelector('#toast');

const findings = [
  'Kontrola dokončena: nic se úspěšně schovává na očích.',
  'Nalezen průvan. Po krátkém výslechu byl propuštěn.',
  'Detektor zapípal, ale jen ze slušnosti.',
  'Pátrání rozšířeno. Nic zůstává v přesile.',
  'Podezřelý stín byl identifikován jako váš vlastní.',
  'Výborně. Teď jsme si ještě jistější, že tu nic není.'
];

let inspections = 1;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function createNothingParticles(origin) {
  const labels = ['NIC', 'PRÁZDNO', 'NIC MOC', 'ZASE NIC', 'NULA'];
  const box = origin.getBoundingClientRect();

  for (let i = 0; i < 7; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'nothing-particle';
    particle.textContent = labels[Math.floor(Math.random() * labels.length)];
    particle.style.left = `${box.left + box.width / 2 + (Math.random() - 0.5) * 80}px`;
    particle.style.top = `${box.top + box.height / 2}px`;
    particle.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 240}px`);
    particle.style.setProperty('--spin', `${(Math.random() - 0.5) * 70}deg`);
    document.body.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

inspectButton.addEventListener('click', () => {
  inspections += 1;
  counter.textContent = `PROVEDENÉ KONTROLY: ${String(inspections).padStart(2, '0')}`;
  result.textContent = findings[(inspections - 2) % findings.length];

  const fakeProgress = Math.min(2, inspections % 3);
  gaugeFill.style.width = `${fakeProgress}%`;
  gaugeValue.textContent = `${fakeProgress} %`;

  createNothingParticles(inspectButton);

  window.setTimeout(() => {
    gaugeFill.style.width = '0%';
    gaugeValue.textContent = '0 %';
  }, 900);
});

foundButton.addEventListener('click', () => {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  result.textContent = 'Ne. To je jen velmi přesvědčivé nic.';
  showToast('Falešný poplach byl zapsán do knihy falešných poplachů.');
});

quietToggle.addEventListener('click', () => {
  const isQuiet = document.body.classList.toggle('quiet');
  quietToggle.setAttribute('aria-pressed', String(isQuiet));
  quietToggle.innerHTML = isQuiet
    ? '<span aria-hidden="true">◑</span> zesílit nic'
    : '<span aria-hidden="true">◐</span> ztlumit nic';
  showToast(isQuiet ? 'Nic bylo úspěšně ztlumeno.' : 'Nic je opět nepřiměřeně hlasité.');
});

tinyButton.addEventListener('click', () => {
  showToast('Oddělení stížností dnes nepřišlo. Nemělo proč.');
});

document.addEventListener('pointermove', (event) => {
  document.body.style.setProperty('--x', `${event.clientX}px`);
  document.body.style.setProperty('--y', `${event.clientY}px`);
});
