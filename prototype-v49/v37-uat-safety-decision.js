
(function () {
  'use strict';
  const root = document.body;

  function setLiveText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  document.addEventListener('click', function (event) {
    const consentButton = event.target.closest('[data-v37-consent]');
    if (consentButton) {
      const card = consentButton.closest('[data-consent-service]');
      const status = consentButton.closest('[data-v37-component="extra-services-consent"]')?.querySelector('.v37-consent-status');
      const service = card?.getAttribute('data-consent-service') || 'услуга';
      const action = consentButton.getAttribute('data-v37-consent');
      card?.querySelectorAll('button').forEach((btn) => btn.classList.remove('is-active'));
      consentButton.classList.add('is-active');
      if (action === 'approved') {
        setLiveText(status, service + ': согласовано владельцем. Услуга добавится к визиту после подтверждения backend.');
        card?.setAttribute('data-consent-state', 'approved');
      } else {
        setLiveText(status, service + ': владелец отказался. Услуга не добавляется к чеку.');
        card?.setAttribute('data-consent-state', 'declined');
      }
    }

    const focusButton = event.target.closest('[data-v37-focus]');
    if (focusButton) {
      const target = document.querySelector(focusButton.getAttribute('data-v37-focus'));
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    }

    const roleButton = event.target.closest('[data-v36rf-role]');
    if (roleButton) {
      const role = roleButton.getAttribute('data-v36rf-role');
      root?.setAttribute('data-clinic-role', role);
      document.querySelectorAll('[data-v36rf-role]').forEach((btn) => btn.classList.toggle('is-active', btn === roleButton));
      const live = document.querySelector('.v37-doctor-context');
      if (live && role === 'doctor') {
        live.setAttribute('aria-live', 'polite');
      }
    }
  });

  document.querySelectorAll('.v37-compare-card .btn, .v37-compare-card .secondary').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.v37-compare-card').forEach((card) => card.classList.remove('is-selected'));
      button.closest('.v37-compare-card')?.classList.add('is-selected');
    });
  });
})();
