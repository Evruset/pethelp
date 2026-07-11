(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const routeLabels = {
    '#home': 'Главная',
    '#catalog': 'Клиники',
    '#appointments': 'Записи',
    '#pets': 'Питомцы',
    '#pet-profile': 'Карточка питомца',
    '#diary': 'Медкарта и дневник',
    '#telemed': 'Онлайн-помощь',
    '#telemed-check': 'Проверка связи',
    '#telemed-waiting': 'Ожидание врача',
    '#telemed-call': 'Видеоконсультация',
    '#telemed-summary': 'Итог консультации',
    '#insurance': 'Страхование',
    '#notifications': 'Уведомления',
    '#profile': 'Профиль владельца',
    '#emergency': 'Срочная помощь',
    '#clinic': 'Карточка клиники',
    '#doctor-select': 'Выбор специалиста',
    '#doctor-detail': 'Профиль врача',
    '#booking': 'Выбор времени',
    '#booking-review': 'Проверка записи',
    '#appointment-detail': 'Детали записи',
    '#alternative-slot': 'Альтернативное время',
    '#clinic-workspace': 'Очередь клиники',
    '#clinic-schedule': 'Расписание клиники',
    '#clinic-visit': 'Рабочее место врача'
  };

  function icon(useId) {
    return `<svg aria-hidden="true" class="vh-icon" focusable="false"><use href="#${useId}"></use></svg>`;
  }

  function ensurePrototypeDockLabel() {
    const dock = $('.prototype-state-dock');
    if (!dock) return;
    dock.setAttribute('role', 'complementary');
    dock.setAttribute('aria-label', 'Панель демонстрационных состояний прототипа для стейкхолдеров');
    dock.dataset.audience = 'stakeholder';
    dock.dataset.uiSurface = 'prototype-control';
    const toggle = $('.prototype-state-toggle', dock);
    if (toggle) {
      toggle.setAttribute('aria-label', 'Открыть или скрыть панель демонстрационных состояний прототипа');
    }
  }

  function ensureIconLinkLabels() {
    $$('a.icon-btn').forEach((link) => {
      if (link.getAttribute('aria-label')) return;
      const href = link.getAttribute('href') || '';
      const title = link.getAttribute('title');
      const text = link.textContent.trim();
      const label = title || text || routeLabels[href] || 'Открыть раздел';
      link.setAttribute('aria-label', label);
      $$('svg, img', link).forEach((visual) => {
        visual.setAttribute('aria-hidden', 'true');
        visual.setAttribute('focusable', 'false');
      });
    });
  }

  function markImplementationCopy() {
    const implementationPatterns = [
      /backend/i,
      /production/i,
      /server snapshot/i,
      /server event/i,
      /Booking Core/i,
      /terminal state/i,
      /идемпотент/i,
      /рабочем приложении/i,
      /в реальном сервисе/i,
      /В сервисе доступность/i,
      /В прототипе переход/i,
      /В прототипе показана/i
    ];

    $$('.media-note, .empty-note, .add-on-status, p.muted, small').forEach((node) => {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (implementationPatterns.some((pattern) => pattern.test(text))) {
        node.dataset.copyRole = 'implementation-note';
      }
    });
  }

  function convertDateControls() {
    $$('.date-strip a.day').forEach((anchor) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = anchor.className;
      button.innerHTML = anchor.innerHTML;
      button.dataset.dateLabel = anchor.textContent.replace(/\s+/g, ' ').trim();
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', anchor.classList.contains('active') ? 'true' : 'false');
      button.setAttribute('aria-label', `Выбрать дату ${button.dataset.dateLabel}`);
      anchor.replaceWith(button);
    });

    $$('.date-strip').forEach((strip) => {
      if (!strip.getAttribute('role')) strip.setAttribute('role', 'radiogroup');
      if (!strip.getAttribute('aria-label')) strip.setAttribute('aria-label', 'Выбор даты записи');
    });
  }

  function convertServiceControls() {
    $$('a.service-option').forEach((anchor) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = anchor.className;
      button.innerHTML = anchor.innerHTML;
      button.dataset.route = anchor.getAttribute('href') || '';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', anchor.classList.contains('selected') ? 'true' : 'false');
      button.setAttribute('aria-label', `Выбрать услугу ${anchor.textContent.replace(/\s+/g, ' ').trim()}`);
      anchor.replaceWith(button);
    });

    const serviceOptions = $$('.service-option[role="radio"]');
    if (serviceOptions.length) {
      const parent = serviceOptions[0].parentElement;
      if (parent && !parent.getAttribute('role')) {
        parent.setAttribute('role', 'radiogroup');
        parent.setAttribute('aria-label', 'Выбор услуги');
      }
    }
  }

  function rebuildCallControls() {
    const call = $('#telemed-call .call-controls.extended');
    if (!call || call.dataset.p1Rebuilt === 'true') return;
    call.dataset.p1Rebuilt = 'true';
    call.innerHTML = `
      <button class="call-control" type="button" aria-pressed="true" aria-label="Выключить микрофон" data-call-control="microphone">${icon('i-mic')}</button>
      <button class="call-control" type="button" aria-pressed="true" aria-label="Выключить камеру" data-call-control="camera">${icon('i-video')}</button>
      <button class="call-control" type="button" aria-label="Сменить камеру" data-call-control="switch-camera">${icon('i-camera-switch')}</button>
      <button class="call-control" type="button" aria-pressed="true" aria-label="Выключить динамик" data-call-control="speaker">${icon('i-speaker')}</button>
      <button class="call-control" type="button" aria-label="Открыть чат консультации" data-call-control="chat">${icon('i-chat')}</button>
      <button class="call-control end" type="button" aria-label="Завершить консультацию" data-call-control="end-call">${icon('i-end-call')}</button>
    `.trim();

    call.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-call-control]');
      if (!button) return;
      const control = button.dataset.callControl;
      if (control === 'end-call') {
        if (typeof window.navigateTo === 'function') window.navigateTo('telemed-summary');
        else window.location.hash = '#telemed-summary';
        return;
      }
      if (['microphone', 'camera', 'speaker'].includes(control)) {
        const isPressed = button.getAttribute('aria-pressed') === 'true';
        button.setAttribute('aria-pressed', String(!isPressed));
        const labels = {
          microphone: isPressed ? 'Включить микрофон' : 'Выключить микрофон',
          camera: isPressed ? 'Включить камеру' : 'Выключить камеру',
          speaker: isPressed ? 'Включить динамик' : 'Выключить динамик'
        };
        button.setAttribute('aria-label', labels[control]);
      }
    });
  }

  function convertActionAnchors() {
    const isSamePageAction = (anchor) => {
      if (anchor.closest('.staff-nav-tabs, .v48-admin-tabs')) return false;
      const href = anchor.getAttribute('href') || '';
      const page = anchor.closest('.page');
      const pageId = page?.id ? `#${page.id}` : '';
      const text = anchor.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
      return href === pageId ||
        /обновить статус|отменить заявку|изменить фото|редактировать фото|проверить покрытие|позвонить|экспорт смены/i.test(text) ||
        anchor.classList.contains('photo-edit');
    };

    $$('a').filter(isSamePageAction).forEach((anchor) => {
      if (anchor.closest('.call-controls')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = anchor.className;
      button.innerHTML = anchor.innerHTML;
      const text = anchor.textContent.replace(/\s+/g, ' ').trim() || anchor.getAttribute('title') || 'Выполнить действие';
      button.setAttribute('aria-label', text);
      button.dataset.prototypeAction = text;
      anchor.replaceWith(button);
    });
  }

  function setupRadioRoving() {
    function updateRadioGroup(group) {
      const radios = $$('[role="radio"]', group);
      const checked = radios.find((radio) => radio.getAttribute('aria-checked') === 'true') || radios[0];
      radios.forEach((radio) => {
        radio.tabIndex = radio === checked ? 0 : -1;
      });
    }

    function selectRadio(radio) {
      const group = radio.closest('[role="radiogroup"]');
      if (!group) return;
      $$('[role="radio"]', group).forEach((item) => {
        const selected = item === radio;
        item.setAttribute('aria-checked', selected ? 'true' : 'false');
        item.classList.toggle('active', selected);
        item.classList.toggle('selected', selected);
      });
      updateRadioGroup(group);
    }

    $$('[role="radiogroup"]').forEach((group) => {
      updateRadioGroup(group);
      if (group.dataset.p1Roving === 'true') return;
      group.dataset.p1Roving = 'true';
      group.addEventListener('click', (event) => {
        const radio = event.target.closest('[role="radio"]');
        if (radio && group.contains(radio)) selectRadio(radio);
      });
      group.addEventListener('keydown', (event) => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', ' ', 'Enter'];
        if (!keys.includes(event.key)) return;
        const radios = $$('[role="radio"]', group).filter((item) => !item.disabled && item.getAttribute('aria-disabled') !== 'true');
        if (!radios.length) return;
        const current = document.activeElement.closest('[role="radio"]');
        if (!current || !group.contains(current)) return;
        event.preventDefault();
        let index = radios.indexOf(current);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % radios.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index - 1 + radios.length) % radios.length;
        if (event.key === 'Home') index = 0;
        if (event.key === 'End') index = radios.length - 1;
        const next = radios[index];
        selectRadio(next);
        next.focus({ preventScroll: true });
        if (event.key === ' ' || event.key === 'Enter') next.click();
      });
    });

    window.updateRadioGroup = updateRadioGroup;
  }

  function addStatusNonColorSignals() {
    const map = [
      ['green', '✓'],
      ['yellow', '•'],
      ['warning', '•'],
      ['red', '!'],
      ['danger', '!'],
      ['blue', 'i']
    ];
    $$('.pill').forEach((pill) => {
      if (pill.dataset.a11yStatusIcon) return;
      const cls = pill.className;
      const match = map.find(([name]) => cls.includes(name));
      if (match) pill.dataset.a11yStatusIcon = match[1];
    });
  }

  function injectTabletNav() {
    if ($('.tablet-compact-nav')) return;
    const main = $('.main');
    if (!main) return;
    const nav = document.createElement('nav');
    nav.className = 'tablet-compact-nav';
    nav.setAttribute('aria-label', 'Планшетная навигация VetHelp');
    nav.innerHTML = `
      <div class="tablet-compact-nav__links">
        <a href="#home" data-tablet-route="home">Главная</a>
        <a href="#catalog" data-tablet-route="catalog">Клиники</a>
        <a href="#appointments" data-tablet-route="appointments">Записи</a>
        <a href="#clinic-workspace" data-tablet-route="clinic-workspace">Очередь</a>
        <a href="#clinic-schedule" data-tablet-route="clinic-schedule">Расписание</a>
      </div>
      <details>
        <summary aria-label="Открыть дополнительные разделы">Ещё</summary>
        <div class="tablet-compact-nav__menu">
          <a href="#clinic-visit" data-tablet-route="clinic-visit">Визит врача</a>
          <a href="#telemed" data-tablet-route="telemed">Онлайн</a>
          <a href="#insurance" data-tablet-route="insurance">Страхование</a>
          <a href="#diary" data-tablet-route="diary">Дневник</a>
          <a href="#profile" data-tablet-route="profile">Профиль</a>
        </div>
      </details>
    `.trim();
    main.insertBefore(nav, main.firstChild);
  }

  function updateNavCurrent() {
    const route = (location.hash || '#home').replace(/^#/, '');
    $$('[data-tablet-route]').forEach((link) => {
      if (link.dataset.tabletRoute === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function setupMobileMediaDisclosure() {
    const selectors = [
      '.doctor-hero',
      '.clinic-gallery',
      '.rich-map',
      '.document-card img:not(.vh-icon)',
      '.medical-doc-card img:not(.vh-icon)',
      '.visit-doc-card img:not(.vh-icon)'
    ];
    const items = selectors.flatMap((selector) => $$(selector));
    items.forEach((media) => {
      if (media.closest('.mobile-media-disclosure')) return;
      if (media.closest('.home-safety-banner')) return;
      // The primary home map is a main dashboard element, not secondary mobile media.
      // Wrapping it in a closed <details> hid the map on desktop/tablet in v10.
      if (media.matches('.rich-map') && media.closest('#home')) return;
      media.dataset.mobileSecondaryMedia = 'true';
      const parent = media.parentElement;
      if (!parent) return;
      const disclosure = document.createElement('details');
      disclosure.className = 'mobile-media-disclosure';
      const summary = document.createElement('summary');
      summary.textContent = 'Показать изображение';
      parent.insertBefore(disclosure, media);
      disclosure.appendChild(summary);
      const holder = document.createElement('div');
      holder.className = 'mobile-secondary-graphic';
      disclosure.appendChild(holder);
      holder.appendChild(media);
      const desktopQuery = window.matchMedia('(min-width: 768px)');
      const syncDisclosureMode = () => {
        if (desktopQuery.matches) {
          disclosure.open = true;
          disclosure.classList.add('media-expanded');
        } else if (!disclosure.dataset.userToggled) {
          disclosure.open = false;
          disclosure.classList.remove('media-expanded');
        }
      };
      disclosure.addEventListener('toggle', () => {
        disclosure.dataset.userToggled = 'true';
        disclosure.classList.toggle('media-expanded', disclosure.open);
      });
      desktopQuery.addEventListener?.('change', () => {
        if (desktopQuery.matches) delete disclosure.dataset.userToggled;
        syncDisclosureMode();
      });
      syncDisclosureMode();
    });
  }

  function ensureImageAlt() {
    $$('img').forEach((img) => {
      if (img.classList.contains('vh-icon') || img.classList.contains('user-provided-icon')) {
        img.setAttribute('alt', '');
        img.setAttribute('aria-hidden', 'true');
        return;
      }
      if (img.hasAttribute('alt') && img.getAttribute('alt').trim()) return;
      const src = img.getAttribute('src') || '';
      let alt = 'Иллюстрация VetHelp';
      if (src.includes('doctor_anna')) alt = 'Анна Смирнова, ветеринарный терапевт';
      else if (src.includes('doctor_')) alt = 'Профиль ветеринарного врача';
      else if (src.includes('clinic_')) alt = 'Ветеринарная клиника';
      else if (src.includes('pet_barney')) alt = 'Барни, корги';
      else if (src.includes('pet_murka')) alt = 'Мурка, кошка';
      else if (src.includes('pet_lucky')) alt = 'Лаки, лабрадор';
      else if (src.includes('xray')) alt = 'Рентген питомца';
      else if (src.includes('conclusion')) alt = 'Ветеринарное заключение';
      img.setAttribute('alt', alt);
    });
  }

  function init() {
    ensurePrototypeDockLabel();
    ensureIconLinkLabels();
    markImplementationCopy();
    convertDateControls();
    convertServiceControls();
    rebuildCallControls();
    convertActionAnchors();
    setupRadioRoving();
    addStatusNonColorSignals();
    injectTabletNav();
    updateNavCurrent();
    setupMobileMediaDisclosure();
    ensureImageAlt();
    window.addEventListener('hashchange', updateNavCurrent);
    document.documentElement.dataset.vethelpP1 = 'v7';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
