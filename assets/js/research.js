(() => {
  const choices = [...document.querySelectorAll('[data-research-choice]')];
  const panels = choices.map(choice => document.getElementById(choice.dataset.researchChoice));
  if (!choices.length || panels.some(panel => !panel)) return;

  const select = (id, moveFocus = false) => {
    const selected = panels.find(panel => panel.id === id) || panels[0];
    panels.forEach(panel => {
      panel.hidden = panel !== selected;
    });
    choices.forEach(choice => {
      const active = choice.dataset.researchChoice === selected.id;
      choice.classList.toggle('is-active', active);
      choice.setAttribute('aria-expanded', String(active));
      if (active) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
    document.dispatchEvent(new Event('pairs:mediachange'));
    if (moveFocus) {
      selected.tabIndex = -1;
      selected.focus({ preventScroll: true });
      selected.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  };

  choices.forEach(choice => choice.addEventListener('click', event => {
    event.preventDefault();
    const id = choice.dataset.researchChoice;
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    select(id, true);
  }));
  document.querySelectorAll('.research-back-to-grid').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    history.pushState(null, '', '#research-directions');
    const active = choices.find(choice => choice.classList.contains('is-active'));
    active.focus({ preventScroll: true });
    document.getElementById('research-directions').scrollIntoView({ block: 'start' });
  }));
  window.addEventListener('hashchange', () => {
    if (panels.some(panel => `#${panel.id}` === location.hash)) select(location.hash.slice(1), true);
  });
  select(location.hash.slice(1));

  const toggle = document.querySelector('.research-demo-toggle');
  const previewSection = document.querySelector('.research-choices');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const updateToggle = (paused) => {
    previewSection.dataset.previewsPaused = String(paused);
    toggle.textContent = paused ? 'Play previews' : 'Pause previews';
    document.dispatchEvent(new Event('pairs:mediachange'));
  };
  if (toggle && previewSection) {
    toggle.hidden = false;
    updateToggle(reducedMotion.matches || !!navigator.connection?.saveData);
    toggle.addEventListener('click', () => updateToggle(previewSection.dataset.previewsPaused !== 'true'));
    reducedMotion.addEventListener('change', () => updateToggle(reducedMotion.matches));
  }
})();
