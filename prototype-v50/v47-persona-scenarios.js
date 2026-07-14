(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const initPersonaFixtures = () => {
    const fixtures = window.VetHelpUATFixtures;
    if (!fixtures) return;

    const buttons = $$('[data-v47-persona]');
    const summary = $('.prototype-state-persona-summary');
    const toast = $('.prototype-toast');

    const render = (id) => {
      const persona = fixtures.personas.find((item) => item.id === id) || fixtures.personas[0];
      const petNames = persona.pets
        .map((petId) => fixtures.pets.find((pet) => pet.id === petId)?.name)
        .filter(Boolean)
        .join(', ');

      document.body.dataset.uatPersona = persona.id;
      buttons.forEach((button) => {
        const selected = button.dataset.v47Persona === persona.id;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });

      if (summary) {
        summary.innerHTML = `<strong>${persona.name} · ${persona.label}</strong><span>${persona.transport} · достаток: ${persona.income}</span><span>Питомцы: ${petNames}</span><span>Проверяем: ${persona.need}</span>`;
      }

      if (toast) {
        toast.textContent = `Тестовый профиль: ${persona.label}. Продуктовые данные не изменены.`;
        toast.classList.add('show');
        window.clearTimeout(window.__v47PersonaToast);
        window.__v47PersonaToast = window.setTimeout(() => toast.classList.remove('show'), 2600);
      }
    };

    buttons.forEach((button) => button.addEventListener('click', () => render(button.dataset.v47Persona)));
    render('default');
  };

  const initDiaryPeriods = () => {
    $$('#diary .v47-period-switch button').forEach((button) => {
      button.addEventListener('click', () => {
        $$('#diary .v47-period-switch button').forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
      });
    });
  };

  const initMobileCatalogFilters = () => {
    const row = $('#catalog .v40-filter-row');
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

    const filterButtons = $$('button.filter', row);
    const count = $('[data-v50-filter-count]', summary);
    const selection = $('[data-v50-filter-selection]', summary);
    const reset = $('.v50-mobile-filter-reset', actions);
    const apply = $('.v50-mobile-filter-apply', actions);
    const live = $('#vh-live-status');

    const updateSummary = () => {
      const active = filterButtons.filter((button) => button.classList.contains('active'));
      const labels = active.map((button) => button.textContent.trim());

      filterButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.classList.contains('active')));
      });

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
      if (live) live.textContent = 'Фильтры каталога сброшены.';
    });

    apply.addEventListener('click', () => {
      const selectedCount = filterButtons.filter((button) => button.classList.contains('active')).length;
      details.open = false;
      if (live) {
        live.textContent = selectedCount
          ? `Применено фильтров: ${selectedCount}. Показаны подходящие клиники.`
          : 'Показаны все клиники.';
      }
    });

    details.addEventListener('toggle', () => {
      summary.setAttribute('aria-expanded', String(details.open));
    });

    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const syncViewportMode = (event) => {
      details.open = !event.matches;
      summary.setAttribute('aria-expanded', String(details.open));
    };

    syncViewportMode(mobileQuery);
    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncViewportMode);
    } else {
      mobileQuery.addListener(syncViewportMode);
    }

    updateSummary();
  };

  const installMobilePolishStyles = () => {
    const existing = $('#v50-mobile-polish-runtime-styles');
    if (existing) existing.remove();

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

      .skip-link{
        position:fixed!important;
        top:calc(env(safe-area-inset-top,0px) + 8px)!important;
        left:12px!important;
        right:12px!important;
        width:auto!important;
        max-width:none!important;
        opacity:0!important;
        pointer-events:none!important;
        transform:translateY(calc(-100% - 24px))!important;
        transition:opacity .16s ease,transform .16s ease!important;
      }
      .skip-link:focus-visible{
        opacity:1!important;
        pointer-events:auto!important;
        transform:translateY(0)!important;
      }

      .mobile-bottom-nav [data-mobile-route="decision-comparison"],
      .mobile-bottom-nav a[href="#decision-comparison"],
      .mobile-bottom-nav [data-mobile-route="notifications"],
      .mobile-bottom-nav a[href="#notifications"]{
        display:none!important;
      }
      .mobile-bottom-nav,
      .mobile-bottom-nav.v50-mobile-nav-four{
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
      }

      @media(max-width:760px){
        #pet-profile .pet-profile-photo{min-height:280px;}

        .mobile-bottom-nav{
          min-height:64px!important;
          padding:5px!important;
        }
        .mobile-bottom-nav a{
          min-height:50px!important;
          gap:2px!important;
          padding:4px 2px!important;
        }
        .mobile-bottom-nav a .vh-icon,
        .mobile-bottom-nav a>img{
          width:20px!important;
          height:20px!important;
        }
        .mobile-bottom-nav a>span{
          font-size:9px!important;
          line-height:1.1!important;
        }

        body:not(.admin-route) .main :where(
          .mini-icon,
          .quick-action-icon,
          .action-icon,
          .line-icon,
          .cov-ico,
          .setting-ico,
          .note-icon,
          .status-ico
        ){
          width:42px!important;
          height:42px!important;
          min-width:42px!important;
          flex:0 0 42px!important;
          padding:0!important;
          margin:0!important;
          display:grid!important;
          place-items:center!important;
          border-radius:12px!important;
          box-sizing:border-box!important;
        }
        body:not(.admin-route) .main :where(
          .mini-icon,
          .quick-action-icon,
          .action-icon,
          .line-icon,
          .cov-ico,
          .setting-ico,
          .note-icon,
          .status-ico
        ) :where(svg,img){
          width:21px!important;
          height:21px!important;
          max-width:21px!important;
          max-height:21px!important;
          object-fit:contain!important;
        }

        #home .section-header:has(+ .service-grid){
          margin-block:18px 10px!important;
          align-items:center!important;
        }
        #home .section-header:has(+ .service-grid) h2{
          font-size:24px!important;
          margin:0!important;
        }
        #home .section-header:has(+ .service-grid) .section-link{
          font-size:13px!important;
          white-space:nowrap!important;
        }
        #home .service-grid{
          display:grid!important;
          grid-template-columns:1fr!important;
          gap:10px!important;
          margin-block:0 18px!important;
        }
        #home .service-card{
          position:relative!important;
          display:grid!important;
          grid-template-columns:46px minmax(0,1fr) 16px!important;
          grid-template-rows:auto auto!important;
          align-items:center!important;
          column-gap:12px!important;
          row-gap:3px!important;
          min-height:82px!important;
          height:auto!important;
          padding:12px 14px!important;
          border-radius:18px!important;
          overflow:hidden!important;
        }
        #home .service-card::after{
          content:"›";
          grid-column:3!important;
          grid-row:1 / 3!important;
          justify-self:end!important;
          align-self:center!important;
          color:#6d7f99!important;
          font-size:22px!important;
          line-height:1!important;
        }
        #home .service-card .service-icon{
          grid-column:1!important;
          grid-row:1 / 3!important;
          width:46px!important;
          height:46px!important;
          min-width:46px!important;
          display:grid!important;
          place-items:center!important;
          margin:0!important;
          padding:0!important;
          border-radius:14px!important;
        }
        #home .service-card .service-icon :where(svg,img){
          width:23px!important;
          height:23px!important;
          max-width:23px!important;
          max-height:23px!important;
          object-fit:contain!important;
        }
        #home .service-card h3{
          grid-column:2!important;
          grid-row:1!important;
          min-width:0!important;
          margin:0!important;
          font-size:15px!important;
          line-height:1.2!important;
          overflow-wrap:anywhere!important;
        }
        #home .service-card p{
          grid-column:2!important;
          grid-row:2!important;
          display:block!important;
          min-width:0!important;
          margin:0!important;
          color:#68778f!important;
          font-size:11px!important;
          line-height:1.3!important;
          overflow-wrap:anywhere!important;
        }

        #appointments .status-list{gap:8px!important;}
        #appointments .status-list .info-row{
          display:grid!important;
          grid-template-columns:42px minmax(0,1fr) 12px!important;
          align-items:center!important;
          gap:10px!important;
          min-height:72px!important;
          padding:10px 12px!important;
          border-radius:17px!important;
        }
        #appointments .status-list .info-row>span:nth-child(2){min-width:0!important;}
        #appointments .status-list .info-row strong{
          display:block!important;
          font-size:14px!important;
          line-height:1.2!important;
          overflow-wrap:anywhere!important;
        }
        #appointments .status-list .info-row small{
          display:block!important;
          margin-top:3px!important;
          font-size:11px!important;
          line-height:1.3!important;
          overflow-wrap:anywhere!important;
        }
        #appointments .status-list .info-row>span:last-child{
          justify-self:end!important;
          font-size:20px!important;
        }

        #pets-policy-card .v40-policy-benefits{
          display:grid!important;
          grid-template-columns:repeat(6,minmax(0,1fr))!important;
          gap:8px!important;
          margin:12px 0!important;
        }
        #pets-policy-card .v40-policy-benefits>span{
          grid-column:span 2!important;
          min-width:0!important;
          min-height:76px!important;
          padding:8px 4px!important;
          gap:6px!important;
          border-radius:15px!important;
          align-content:center!important;
          justify-items:center!important;
        }
        #pets-policy-card .v40-policy-benefits>span:nth-last-child(-n+2){grid-column:span 3!important;}
        #pets-policy-card .v40-policy-benefits>span img{
          width:23px!important;
          height:23px!important;
          max-width:23px!important;
          max-height:23px!important;
          object-fit:contain!important;
        }
        #pets-policy-card .v40-policy-benefits>span small{
          max-width:100%!important;
          font-size:10px!important;
          line-height:1.15!important;
          text-align:center!important;
          overflow-wrap:anywhere!important;
        }

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
          transform:translateY(-8px);
        }
        .vh-toast-v2.is-visible,
        .prototype-toast.show,
        .prototype-toast.is-visible,
        .v48-toast.show,
        .v48-toast.is-visible{transform:translateY(0);}
      }

      @media(max-width:380px){
        #home .service-card{
          grid-template-columns:42px minmax(0,1fr) 14px!important;
          column-gap:10px!important;
          padding-inline:11px!important;
        }
        #home .service-card .service-icon{
          width:42px!important;
          height:42px!important;
          min-width:42px!important;
        }
        #appointments .status-list .info-row{
          grid-template-columns:38px minmax(0,1fr) 10px!important;
          gap:8px!important;
          padding-inline:10px!important;
        }
        #appointments .status-list .quick-action-icon{
          width:38px!important;
          height:38px!important;
          min-width:38px!important;
          flex-basis:38px!important;
        }
        #pets-policy-card .v40-policy-benefits>span{min-height:72px!important;}
      }
    `;
    document.head.append(style);
  };

  const repairPetPhoto = () => {
    const host = $('#pet-profile .pet-profile-photo');
    if (!host || $('img.v50-pet-profile-image', host)) return;

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

  const MOBILE_NAV_ITEMS = [
    { route: 'home', href: '#home', label: 'Главная', icon: 'i-home' },
    { route: 'pets', href: '#pets', label: 'Питомцы', icon: 'i-paw' },
    { route: 'appointments', href: '#appointments', label: 'Мои записи', icon: 'i-calendar' },
    { route: 'catalog', href: '#catalog', label: 'Клиники', icon: 'i-clinic' }
  ];

  const createMobileNavLink = ({ route, href, label, icon }) => {
    const link = document.createElement('a');
    link.href = href;
    link.dataset.mobileRoute = route;
    link.setAttribute('aria-label', label);
    link.innerHTML = `<svg aria-hidden="true" class="vh-icon" focusable="false"><use href="#${icon}"></use></svg><span>${label}</span>`;
    return link;
  };

  const syncMobileNavActiveState = (nav) => {
    const currentHash = window.location.hash || '#home';
    $$('a[href]', nav).forEach((link) => {
      const active = link.getAttribute('href') === currentHash;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  };

  const simplifyMobileNavigation = () => {
    $$('.mobile-bottom-nav').forEach((nav) => {
      $$('[data-mobile-route="decision-comparison"], a[href="#decision-comparison"], [data-mobile-route="notifications"], a[href="#notifications"]', nav)
        .forEach((link) => link.remove());

      const existingByHref = new Map($$('a[href]', nav).map((link) => [link.getAttribute('href'), link]));
      const orderedLinks = MOBILE_NAV_ITEMS.map((item) => {
        const link = existingByHref.get(item.href) || createMobileNavLink(item);
        link.dataset.mobileRoute = item.route;
        link.setAttribute('aria-label', item.label);
        return link;
      });

      const currentLinks = $$(':scope > a', nav);
      const needsReorder = currentLinks.length !== orderedLinks.length
        || orderedLinks.some((link, index) => currentLinks[index] !== link);

      if (needsReorder) nav.replaceChildren(...orderedLinks);
      nav.classList.add('v50-mobile-nav-four');
      nav.style.setProperty('grid-template-columns', 'repeat(4, minmax(0, 1fr))', 'important');
      syncMobileNavActiveState(nav);
    });
  };

  const stabilizeMobileNavigation = () => {
    simplifyMobileNavigation();

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        simplifyMobileNavigation();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', simplifyMobileNavigation);
    window.addEventListener('pageshow', simplifyMobileNavigation);
  };

  const releaseStickySkipLink = () => {
    const skipLink = $('.skip-link');
    if (!skipLink) return;

    const blurTouchFocus = () => {
      if (document.activeElement === skipLink && !skipLink.matches(':focus-visible')) {
        skipLink.blur();
      }
    };

    window.addEventListener('pageshow', blurTouchFocus);
    window.addEventListener('hashchange', blurTouchFocus);
    document.addEventListener('pointerdown', blurTouchFocus, { passive: true });
    blurTouchFocus();
  };

  const init = () => {
    initPersonaFixtures();
    initDiaryPeriods();
    initMobileCatalogFilters();
    installMobilePolishStyles();
    repairPetPhoto();
    stabilizeMobileNavigation();
    releaseStickySkipLink();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();