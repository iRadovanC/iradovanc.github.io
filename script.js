(() => {
  const shell = document.getElementById('scene-shell');
  const photograph = document.getElementById('photograph');
  const reaction = document.getElementById('reaction');
  const shock = document.getElementById('face-shock');
  const timers = new Map();

  function play(className, duration) {
    shell.classList.remove(className);
    void shell.offsetWidth;
    shell.classList.add(className);
    clearTimeout(timers.get(className));
    timers.set(className, setTimeout(() => shell.classList.remove(className), duration));
  }

  function showShock() {
    shock.classList.remove('show');
    void shock.offsetWidth;
    shock.classList.add('show');
    clearTimeout(timers.get('shock'));
    timers.set('shock', setTimeout(() => shock.classList.remove('show'), 2600));
  }

  const actions = {
    lamp() {
      play('lit', 2600);
      showShock();
      reaction.textContent = 'Někdo si rozsvítil.';
    },
    blast() {
      play('blasted', 1600);
      reaction.textContent = 'To je jen výraznější západ slunce.';
    },
    shadow() {
      play('shadow-leaving', 4100);
      reaction.textContent = 'Stín odmítl vypovídat a odešel.';
    }
  };

  document.querySelectorAll('[data-egg]').forEach(object => {
    object.addEventListener('click', () => actions[object.dataset.egg]());
  });

  const sceneCursor = document.getElementById('scene-cursor');
  const hotspotCursor = event => {
    if (event.pointerType === 'touch' || !document.documentElement.classList.contains('cursor-ready')) return;
    sceneCursor.style.left = `${event.clientX}px`;
    sceneCursor.style.top = `${event.clientY}px`;
    sceneCursor.classList.add('is-visible');
  };
  const hideCursor = () => sceneCursor.classList.remove('is-visible');
  const enableCursor = () => {
    if (sceneCursor.naturalWidth) document.documentElement.classList.add('cursor-ready');
  };
  sceneCursor.addEventListener('load', enableCursor);
  if (sceneCursor.complete) enableCursor();
  document.querySelectorAll('[data-egg]').forEach(object => {
    object.addEventListener('pointerenter', hotspotCursor);
    object.addEventListener('pointermove', hotspotCursor);
    object.addEventListener('pointerleave', hideCursor);
    object.addEventListener('pointercancel', hideCursor);
  });
  window.addEventListener('blur', hideCursor);
  window.addEventListener('scroll', hideCursor, { passive: true });

  let frame = 0;
  shell.addEventListener('pointermove', event => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const rect = shell.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      photograph.style.setProperty('--pan-x', `${-x * 11}px`);
      photograph.style.setProperty('--pan-y', `${-y * 8}px`);
      frame = 0;
    });
  });
  shell.addEventListener('pointerleave', () => {
    photograph.style.setProperty('--pan-x', '0px');
    photograph.style.setProperty('--pan-y', '0px');
  });
})();
