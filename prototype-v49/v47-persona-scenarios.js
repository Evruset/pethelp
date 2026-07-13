(() => {
  'use strict';
  const fixtures = window.VetHelpUATFixtures;
  if (!fixtures) return;
  const buttons = [...document.querySelectorAll('[data-v47-persona]')];
  const summary = document.querySelector('.prototype-state-persona-summary');
  const toast = document.querySelector('.prototype-toast');

  const render = (id) => {
    const persona = fixtures.personas.find((item) => item.id === id) || fixtures.personas[0];
    const petNames = persona.pets.map((petId) => fixtures.pets.find((pet) => pet.id === petId)?.name).filter(Boolean).join(', ');
    document.body.dataset.uatPersona = persona.id;
    buttons.forEach((button) => {
      const selected = button.dataset.v47Persona === persona.id;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (summary) summary.innerHTML = `<strong>${persona.name} · ${persona.label}</strong><span>${persona.transport} · достаток: ${persona.income}</span><span>Питомцы: ${petNames}</span><span>Проверяем: ${persona.need}</span>`;
    if (toast) {
      toast.textContent = `Тестовый профиль: ${persona.label}. Продуктовые данные не изменены.`;
      toast.classList.add('show');
      window.clearTimeout(window.__v47PersonaToast);
      window.__v47PersonaToast = window.setTimeout(() => toast.classList.remove('show'), 2600);
    }
  };

  buttons.forEach((button) => button.addEventListener('click', () => render(button.dataset.v47Persona)));
  render('default');

  document.querySelectorAll('#diary .v47-period-switch button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('#diary .v47-period-switch button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }));
})();
