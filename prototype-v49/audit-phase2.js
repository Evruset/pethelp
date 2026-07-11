/* VetHelp audit hardening phase 2 — semantic interaction, map lifecycle and decision-safe UX. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = () => (location.hash || '#home').slice(1);

  function announce(text) {
    let node = $('#vh-live-announcer');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vh-live-announcer';
      node.className = 'sr-only';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.append(node);
    }
    node.textContent = '';
    window.setTimeout(() => { node.textContent = text; }, 20);
  }

  function createSkipLink() {
    if ($('#skip-to-content')) return;
    const link = document.createElement('a');
    link.id = 'skip-to-content';
    link.className = 'skip-link';
    link.href = '#main-content';
    link.textContent = 'К основному содержанию';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      $('#main-content')?.focus({ preventScroll: false });
    });
    document.body.prepend(link);
  }

  function semanticizePages({ moveFocus = false } = {}) {
    const activeRoute = route();
    const pages = $$('[data-page]');
    pages.forEach((page) => {
      const active = page.dataset.page === activeRoute;
      page.setAttribute('aria-hidden', String(!active));
      page.inert = !active;
      const heading = $('h1', page);
      if (heading) {
        if (!heading.id) heading.id = `heading-${page.dataset.page}`;
        page.setAttribute('aria-labelledby', heading.id);
      }
    });

    $$('[data-route-link]').forEach((link) => {
      const active = link.dataset.routeLink === activeRoute;
      link.toggleAttribute('aria-current', active);
      if (active) link.setAttribute('aria-current', 'page');
    });

    if (moveFocus) {
      const heading = $(`[data-page="${CSS.escape(activeRoute)}"] h1`);
      if (heading) {
        heading.tabIndex = -1;
        window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
      }
    }
  }

  function addOwnerContext() {
    $$('.page .topbar').forEach((topbar) => {
      const first = topbar.firstElementChild;
      if (!first || $('.owner-context-badge', first)) return;
      const badge = document.createElement('span');
      badge.className = 'owner-context-badge';
      badge.textContent = 'Личный кабинет владельца';
      first.prepend(badge);
    });
  }

  function upgradeDoctorControls() {
    const selection = $('#doctor-select');
    if (!selection) return;
    const group = $('.provider-grid', selection);
    if (group) {
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Выбор ветеринарного специалиста');
    }
    $$('.provider-card', selection).forEach((card) => {
      card.setAttribute('aria-pressed', String(card.classList.contains('selected')));
      card.setAttribute('type', 'button');
    });
  }

  function syncChoiceSemantics() {
    const booking = $('#booking');
    if (booking) {
      const dates = $('.date-strip', booking);
      if (dates) {
        dates.setAttribute('role', 'radiogroup');
        dates.setAttribute('aria-label', 'Дата визита');
        $$('.day', dates).forEach((item) => {
          item.setAttribute('role', 'radio');
          item.setAttribute('aria-checked', String(item.classList.contains('active')));
        });
      }
      const slots = $('.slot-grid', booking);
      if (slots) {
        slots.setAttribute('role', 'radiogroup');
        slots.setAttribute('aria-label', 'Доступное время');
        $$('.slot', slots).forEach((item) => {
          item.setAttribute('role', 'radio');
          item.setAttribute('aria-checked', String(item.classList.contains('selected')));
        });
      }
    }

    const alternatives = $('#alternative-slot .alt-slots');
    if (alternatives) {
      alternatives.setAttribute('role', 'radiogroup');
      alternatives.setAttribute('aria-label', 'Варианты времени от клиники');
      $$('.alt-slot', alternatives).forEach((item) => {
        item.setAttribute('role', 'radio');
        item.setAttribute('aria-checked', String(item.getAttribute('aria-pressed') === 'true'));
      });
    }

    $$('#doctor-select .provider-card').forEach((card) => {
      card.setAttribute('aria-pressed', String(card.classList.contains('selected')));
    });
  }

  function careContext() {
    $('#appointment-detail .care-decision-context')?.remove();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function installMapLifecycle() {
    $$('iframe[src*="yandex.ru/map-widget"], iframe[data-vh-map-src]').forEach((iframe, index) => {
      if (iframe.dataset.vhMapManaged === 'true') return;
      iframe.dataset.vhMapManaged = 'true';
      iframe.dataset.vhMapSrc = iframe.getAttribute('src') || iframe.dataset.vhMapSrc || '';
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

      const page = iframe.closest('[data-page]');
      const isHomeMap = page?.dataset.page === 'home';
      iframe.loading = isHomeMap ? 'eager' : 'lazy';

      // Home map is first-screen content: keep Yandex iframe alive there.
      // Hidden catalog map remains lazy and uses a static fallback until opened.
      if (isHomeMap) {
        if (!iframe.getAttribute('src') && iframe.dataset.vhMapSrc) {
          iframe.setAttribute('src', iframe.dataset.vhMapSrc);
        }
        iframe.dataset.vhMapPrimary = 'true';
        return;
      }

      iframe.removeAttribute('src');
      const fallback = document.createElement('figure');
      fallback.className = 'map-static-fallback';
      fallback.dataset.mapFallback = String(index);
      fallback.innerHTML = `
        <img src="vethelp_media/banner_owner_clinic.webp" alt="Статическая схема расположения ветеринарных клиник" loading="lazy" decoding="async" width="960" height="540" />
        <figcaption><strong>Карта клиник</strong><small>Интерактивная карта загружается только на открытом экране. В экспорте используется статическое превью.</small></figcaption>
        <button type="button" class="btn secondary" data-load-map="${index}">Показать интерактивную карту</button>`;
      iframe.after(fallback);
      fallback.querySelector('[data-load-map]')?.addEventListener('click', () => {
        iframe.setAttribute('src', iframe.dataset.vhMapSrc);
        fallback.hidden = true;
        announce('Интерактивная карта загружается.');
      });
    });
    updateMaps();
  }

  function updateMaps() {
    const activeRoute = route();
    $$('iframe[data-vh-map-managed="true"]').forEach((iframe) => {
      const page = iframe.closest('[data-page]');
      const isHomeMap = page?.dataset.page === 'home';
      const visible = page?.dataset.page === activeRoute;
      const fallback = iframe.nextElementSibling?.matches('.map-static-fallback') ? iframe.nextElementSibling : null;

      if (isHomeMap) {
        if (visible && iframe.dataset.vhMapSrc) {
          iframe.setAttribute('src', iframe.dataset.vhMapSrc);
        }
        if (fallback) fallback.hidden = true;
        return;
      }

      if (visible) {
        iframe.setAttribute('src', iframe.dataset.vhMapSrc);
        if (fallback) fallback.hidden = true;
      } else {
        iframe.removeAttribute('src');
        if (fallback) fallback.hidden = false;
      }
    });
  }

  function installConfirmDialog() {
    if ($('#vh-confirm-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'vh-confirm-dialog';
    dialog.className = 'vh-confirm-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="vh-confirm-dialog__body">
        <h2>Подтвердите действие</h2>
        <p data-dialog-copy></p>
        <div class="vh-confirm-dialog__actions">
          <button class="btn secondary" value="cancel">Вернуться</button>
          <button class="btn danger" value="confirm" data-dialog-confirm>Подтвердить</button>
        </div>
      </form>`;
    document.body.append(dialog);

    const open = (copy, onConfirm) => {
      $('[data-dialog-copy]', dialog).textContent = copy;
      dialog.returnValue = '';
      dialog.showModal();
      const confirm = $('[data-dialog-confirm]', dialog);
      const onClose = () => {
        if (dialog.returnValue === 'confirm') onConfirm?.();
        dialog.removeEventListener('close', onClose);
      };
      dialog.addEventListener('close', onClose);
      confirm?.focus();
    };

    document.addEventListener('click', (event) => {
      const cancelAppointment = event.target.closest('[data-appointment-cancel]');
      if (cancelAppointment && cancelAppointment.dataset.confirmed !== 'true') {
        event.preventDefault();
        event.stopPropagation();
        open('Отменить заявку? В рабочем сервисе окончательный результат зависит от серверного статуса и правил клиники.', () => {
          cancelAppointment.dataset.confirmed = 'true';
          cancelAppointment.click();
          announce('Демонстрационная отмена заявки запущена.');
        });
        return;
      }
      const cancelTelemed = event.target.closest('#telemed-wait a.btn.danger');
      if (cancelTelemed) {
        event.preventDefault();
        event.stopPropagation();
        open('Отменить консультацию? До подключения врача в рабочем сервисе отменяется авторизация оплаты, а не обещается возврат.', () => {
          location.hash = '#telemed';
          announce('Консультация отменена в демонстрационном сценарии.');
        });
      }
    }, true);
  }

  function attachPageMutationObserver() {
    const main = $('#main-content');
    if (!main || main.dataset.phase2Observed === 'true') return;
    main.dataset.phase2Observed = 'true';
    const observer = new MutationObserver(() => {
      syncChoiceSemantics();
      careContext();
      semanticizePages();
    });
    observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function onRouteChange() {
    semanticizePages({ moveFocus: true });
    updateMaps();
    syncChoiceSemantics();
    careContext();
  }

  function init() {
    const main = $('.main');
    if (main) {
      main.id = 'main-content';
      main.tabIndex = -1;
      main.setAttribute('aria-label', 'Личный кабинет владельца VetHelp');
    }
    createSkipLink();
    addOwnerContext();
    upgradeDoctorControls();
    installMapLifecycle();
    installConfirmDialog();
    semanticizePages();
    syncChoiceSemantics();
    careContext();
    attachPageMutationObserver();
    window.addEventListener('hashchange', onRouteChange);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
