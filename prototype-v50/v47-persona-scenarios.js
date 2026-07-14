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

/* v50: replace the overflowing mobile catalog chips with an accessible disclosure. */
(() => {
  'use strict';

  const initMobileCatalogFilters = () => {
    const row = document.querySelector('#catalog .v40-filter-row');
    if (!row || row.closest('.v50-mobile-filter-disclosure')) return;

    const details = document.createElement('details');
    details.className = 'v50-mobile-filter-disclosure';

    const summary = document.createElement('summary');
    summary.className = 'v50-mobile-filter-summary';
    summary.innerHTML = `
      <span class="v50-mobile-filter-summary__icon" aria-hidden="true">
        <svg class="vh-icon" focusable="false"><use href="#i-filter"></use></svg>
      </span>
      <span class="v50-mobile-filter-summary__copy">
        <strong>Фильтры</strong>
        <small data-v50-filter-selection>Рядом</small>
      </span>
      <span class="v50-mobile-filter-count" data-v50-filter-count aria-label="Выбрано фильтров">1</span>
      <span class="v50-mobile-filter-chevron" aria-hidden="true">⌄</span>`;

    const panel = document.createElement('div');
    panel.className = 'v50-mobile-filter-panel';

    const actions = document.createElement('div');
    actions.className = 'v50-mobile-filter-actions';
    actions.innerHTML = `
      <button class="v50-mobile-filter-reset" type="button">Сбросить</button>
      <button class="v50-mobile-filter-apply" type="button">Показать результаты</button>`;

    row.before(details);
    row.classList.add('v50-mobile-filter-options');
    details.append(summary, panel);
    panel.append(row, actions);

    const filterButtons = [...row.querySelectorAll('button.filter')];
    const count = summary.querySelector('[data-v50-filter-count]');
    const selection = summary.querySelector('[data-v50-filter-selection]');
    const reset = actions.querySelector('.v50-mobile-filter-reset');
    const apply = actions.querySelector('.v50-mobile-filter-apply');
    const live = document.getElementById('vh-live-status');

    const updateSummary = () => {
      const active = filterButtons.filter((button) => button.classList.contains('active'));
      const labels = active.map((button) => button.textContent.trim());
      filterButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
      count.textContent = String(active.length);
      count.hidden = active.length === 0;
      selection.textContent = labels.length === 0
        ? 'Все клиники'
        : labels.length <= 2
          ? labels.join(', ')
          : `${labels.slice(0, 2).join(', ')} и ещё ${labels.length - 2}`;
    };

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateSummary();
      });
    });

    reset.addEventListener('click', () => {
      filterButtons.forEach((button) => button.classList.remove('active'));
      updateSummary();
      live && (live.textContent = 'Фильтры каталога сброшены.');
    });

    apply.addEventListener('click', () => {
      const selectedCount = filterButtons.filter((button) => button.classList.contains('active')).length;
      details.open = false;
      live && (live.textContent = selectedCount
        ? `Применено фильтров: ${selectedCount}. Показаны подходящие клиники.`
        : 'Показаны все клиники.');
    });

    details.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(details.open)));

    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const syncViewportMode = (event) => {
      details.open = !event.matches;
      summary.setAttribute('aria-expanded', String(details.open));
    };
    syncViewportMode(mobileQuery);
    if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', syncViewportMode);
    else mobileQuery.addListener(syncViewportMode);

    updateSummary();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMobileCatalogFilters, { once: true });
  else initMobileCatalogFilters();
})();

/* v50 mobile polish: real pet photo, four-item navigation and top-safe toasts. */
(() => {
  'use strict';

  const installStyles = () => {
    if (document.getElementById('v50-mobile-polish-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'v50-mobile-polish-runtime-styles';
    style.textContent = `
      #pet-profile .pet-profile-photo > img.v50-pet-profile-image{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
        object-position:center 38%;
      }
      #pet-profile .pet-profile-photo{position:relative;min-height:320px;}
      .mobile-bottom-nav.v50-mobile-nav-four{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
      }
      @media(max-width:760px){
        #pet-profile .pet-profile-photo{min-height:280px;}
        .vh-toast-v2,
        .prototype-toast,
        .v48-toast{
          top:calc(env(safe-area-inset-top,0px) + 12px)!important;
          right:12px!important;
          bottom:auto!important;
          left:12px!important;
          width:auto!important;
          max-width:none!important;
          margin:0!important;
          z-index:12000!important;
        }
        .vh-toast-v2,
        .prototype-toast,
        .v48-toast{transform:translateY(-8px);}
        .vh-toast-v2.is-visible,
        .prototype-toast.show,
        .prototype-toast.is-visible,
        .v48-toast.show,
        .v48-toast.is-visible{transform:translateY(0);}
      }
    `;
    document.head.append(style);
  };

  const repairPetPhoto = () => {
    const host = document.querySelector('#pet-profile .pet-profile-photo');
    if (!host || host.querySelector('img.v50-pet-profile-image')) return;
    const image = document.createElement('img');
    image.className = 'v50-pet-profile-image';
    image.src = 'vethelp_media/pet_barney.webp';
    image.alt = 'Барни, корги';
    image.width = 1254;
    image.height = 1254;
    image.loading = 'eager';
    image.decoding = 'async';
    image.fetchPriority = 'high';
    host.prepend(image);
  };

  const simplifyMobileNavigation = () => {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) return false;
    nav.querySelectorAll('[data-mobile-route="decision-comparison"], a[href="#decision-comparison"]').forEach((link) => link.remove());
    nav.classList.add('v50-mobile-nav-four');
    return true;
  };

  const init = () => {
    installStyles();
    repairPetPhoto();
    if (simplifyMobileNavigation()) return;
    const observer = new MutationObserver(() => {
      if (simplifyMobileNavigation()) observer.disconnect();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.setTimeout(() => observer.disconnect(), 5000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
