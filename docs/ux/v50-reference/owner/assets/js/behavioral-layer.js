(() => {
  'use strict';
  const copy = {
    today: 'Сначала показываем клиники, где Барни может попасть к подходящему специалисту сегодня; цена и дорога остаются видимыми.',
    price: 'Сравниваем стоимость сопоставимого первичного приёма и отдельно показываем, что может оплачиваться дополнительно.',
    near: 'Ставим выше варианты с меньшим временем в пути, не скрывая специализацию, подтверждение слота и цену.',
    confidence: 'Ставим выше варианты с подходящим специалистом, проверенными данными, понятной ценой и подтверждаемым окном.'
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-bh-priority-value]');
    if (!button) return;
    const root = button.closest('[data-bh-priority]');
    root?.querySelectorAll('[data-bh-priority-value]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    const explain = root?.querySelector('[data-bh-priority-explain]');
    if (explain) explain.textContent = copy[button.dataset.bhPriorityValue] || copy.today;
  });
})();
