(() => {
  const headerActions = '<a aria-label="Открыть уведомления" class="icon-btn notification" href="#notifications" data-v35-touch-target="checked"><svg aria-hidden="true" class="vh-icon" focusable="false"><use href="#i-bell"></use></svg></a><a aria-label="Екатерина, личный кабинет" class="user-mini owner-photo" href="#profile" role="img" data-v35-touch-target="checked"></a>';

  const normalizeHeaders = (root = document) => {
    const pages = [...root.querySelectorAll('.page')];
    if (root instanceof Element && root.matches('.page')) pages.unshift(root);
    pages.forEach((page) => {
      if (page.querySelector(':scope > .topbar')) return;
      const topbar = document.createElement('header');
      topbar.className = 'topbar v42-actions-only';
      topbar.innerHTML = '<span aria-hidden="true"></span><div class="actions"></div>';
      const backLink = page.querySelector(':scope > .back-link');
      backLink ? backLink.after(topbar) : page.prepend(topbar);
    });
    const topbars = [...root.querySelectorAll('.topbar')];
    if (root instanceof Element && root.matches('.topbar')) topbars.unshift(root);
    topbars.forEach((topbar) => {
      let actions = topbar.querySelector(':scope > .actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'actions';
        topbar.append(actions);
      }
      const first = actions.children[0];
      const second = actions.children[1];
      const isCanonical = actions.children.length === 2
        && first?.matches('a.icon-btn.notification[href="#notifications"][data-v35-touch-target="checked"]')
        && second?.matches('a.user-mini.owner-photo[href="#profile"][role="img"][data-v35-touch-target="checked"]');
      if (isCanonical) return;
      actions.className = 'actions';
      actions.innerHTML = headerActions;
    });
    document.body?.classList.add('v42-headers-ready');
  };

  const replacements = [
    ['UAT decision screen', 'Экран приёмочного решения'],
    ['Выбор строится по safety/value', 'Выбор строится по безопасности и выгоде'],
    ['catalog read model', 'модели чтения каталога'],
    ['quality profile', 'профиля качества'],
    ['slot freshness', 'актуальности слотов'],
    ['consent-to-extra-service', 'согласования дополнительной услуги'],
    ['server-authoritative confirmation', 'подтверждения сервером'],
    ['queue position, wait estimate, payment hold and capture state', 'позиция в очереди, ожидаемое время, резерв и списание оплаты'],
    ['Telemed Orchestrator and Payments/Ledger', 'систем управления консультациями и оплатой'],
    ['VoiceOver/NVDA: emergency, booking, alternative slot, telemed wait, B2B queue', 'Экранные дикторы: срочная помощь, запись, альтернативное время, ожидание врача и очередь клиники'],
    ['CSS split/purge, critical CSS, lazy maps, responsive images', 'разделение и очистка стилей, критические стили, отложенная карта и адаптивные изображения'],
    ['role mode не является security boundary', 'ролевой режим не является границей безопасности'],
    ['RBAC/ABAC проверяется server-side', 'права доступа проверяются на сервере'],
    ['Backend state machine, API-contract и RBAC/ABAC здесь не реализуются', 'Серверная модель состояний, контракт взаимодействия и проверка прав здесь не реализуются'],
    ['collision detection выполняется на уровне resource calendar с проверкой overlap, source priority и active hold/appointment state', 'конфликты проверяются в календаре ресурсов с учётом пересечений, приоритета источника и активного резерва или записи'],
    ['task order приходит из clinic queue read model', 'порядок задач приходит из модели очереди клиники'],
    ['timer визуализирует server expires_at', 'таймер показывает серверное время окончания'],
    ['idempotency key', 'ключом идемпотентности'],
    ['policy limit', 'ограничением правил'],
    ['ACTIVE_HOLD или CONFIRMED', '«зарезервировано» или «подтверждено»'],
    ['Owner app · service THERAPY_INITIAL', 'Приложение владельца · первичный приём'],
    ['Resource collision guard', 'Защита от конфликтов ресурсов'],
    ['Reception mobile task-flow', 'Мобильный сценарий задач администратора'],
    ['Mobile B2B task-flow', 'Мобильный корпоративный сценарий задач'],
    ['Mobile task-flow ресепшена', 'Мобильный сценарий задач администратора'],
    ['Clinic quality profile', 'Профиль качества клиники'],
    ['Trust / Price / Reviews', 'Доверие, цена и отзывы'],
    ['VetManager API', 'Интерфейс VetManager'],
    ['Language-system статусов', 'Единый язык статусов'],
    ['Booking Core', 'ядро записи'],
    ['Pet-context routing', 'Маршрутизация по данным питомца'],
    ['Decision-система питомца', 'Система решений по питомцу'],
    ['Быстрые preview документов', 'Быстрый просмотр документов'],
    ['SOS hierarchy', 'Иерархия срочных действий'],
    ['SOS-приоритет', 'Экстренный приоритет'],
    ['SOS-поток', 'Экстренный сценарий'],
    ['SOS — Экстренный вызов', 'Экстренный вызов'],
    ['Клиника workspace', 'Рабочее место клиники'],
    ['server-confirmed', 'подтверждённого сервером'],
    ['server-статусом', 'серверным статусом'],
    ['server expires_at', 'серверное время окончания'],
    ['authoritative-ответ', 'подтверждённый ответ'],
    ['подтверждённый-ответ', 'подтверждённый ответ'],
    ['authoritative snapshot', 'подтверждённого снимка состояния'],
    ['snapshot', 'снимка состояния'],
    ['consent command', 'команду согласия'],
    ['audit event', 'событие аудита'],
    ['ledger draft', 'черновик расчёта'],
    ['confirmation', 'подтверждения'],
    ['capabilities', 'возможностей'],
    ['frontend', 'интерфейс'],
    ['workspace', 'рабочего места'],
    ['production', 'рабочей версии'],
    ['staff workspace', 'рабочее место сотрудника'],
    ['summary', 'итоги'],
    ['Trust-score', 'Оценка доверия'],
    ['fallback', 'запасной вариант'],
    ['skip-link', 'ссылка пропуска'],
    ['polite live-region', 'вежливые сообщения для экранного диктора'],
    ['shimmer', 'мерцание'],
    ['overlay-анимации', 'анимации наложения'],
    ['prefers-reduced-motion', 'настройку уменьшения движения'],
    ['critical symptom', 'критическом симптоме'],
    ['OTP', 'кода подтверждения'],
    ['TTL', 'срок действия'],
    ['command', 'команду'],
    ['hold', 'резерв'],
    ['swap', 'переноса'],
    ['KPI', 'показатели'],
    ['BCS', 'оценка упитанности'],
    ['SOS', 'Экстренно'],
    ['Главный CTA', 'Главная кнопка действия'],
    ['comparison', 'сравнение'],
    ['server-подтверждённого', 'подтверждённого сервером'],
    ['server подтверждённого', 'подтверждённого сервером'],
    ['сервер-статусом', 'серверным статусом'],
    ['Telemed Orchestrator', 'системы управления консультациями'],
    ['Payments/Ledger', 'системы оплаты и расчётов'],
    ['VetHelp Workspace', 'рабочее место VetHelp'],
    ['VetHelp Booking', 'система записи VetHelp'],
    ['aria-live', 'Оповещения для экранного диктора'],
    ['FIFO', 'порядок поступления'],
    ['Red flag guardrail', 'Защита при критических признаках'],
    ['red flags', 'критические признаки'],
    ['red flag', 'критическом признаке'],
    ['Care Journey', 'Маршрут помощи'],
    ['care journey', 'маршрута помощи'],
    ['Capability profile', 'Профиль возможностей'],
    ['capability profile', 'профиль возможностей'],
    ['verified emergency capabilities', 'подтверждённым возможностям экстренной помощи'],
    ['verified', 'проверено'],
    ['Decision comparison', 'Сравнение вариантов'],
    ['Safety / Value', 'Безопасность и выгода'],
    ['Safety', 'Безопасность'],
    ['Value', 'Выгода'],
    ['Backend note', 'Техническое примечание'],
    ['Backend rule', 'Правило сервера'],
    ['backend', 'сервер'],
    ['server-authoritative', 'подтверждённый сервером'],
    ['server authoritative', 'подтверждённый сервером'],
    ['authoritative', 'подтверждённый'],
    ['Mobile emergency QA', 'Проверка срочного сценария на мобильном'],
    ['Fallback', 'Запасной вариант'],
    ['Offline', 'Без сети'],
    ['Clinic Workspace', 'Рабочее место клиники'],
    ['Clinic workspace', 'Рабочее место клиники'],
    ['Staff prototype', 'Прототип для сотрудников'],
    ['Clinic CRM roles', 'Роли в системе клиники'],
    ['Mobile-first reception', 'Рабочее место администратора на мобильном'],
    ['Doctor mode', 'Режим врача'],
    ['Risk-first', 'Сначала риски'],
    ['Schedule view', 'Расписание'],
    ['Visit workspace', 'Рабочее место визита'],
    ['Clinical summary', 'Клиническое заключение'],
    ['clinical summary', 'клиническое заключение'],
    ['Audit trail', 'История действий'],
    ['audit trail', 'история действий'],
    ['Staff actions', 'Действия сотрудников'],
    ['No-show risk', 'Риск неявки'],
    ['No-Show Риск', 'Риск неявки'],
    ['No-show', 'Неявка'],
    ['check-in', 'регистрации на приём'],
    ['Check-in', 'Регистрация на приём'],
    ['Pet Diary', 'Дневник питомца'],
    ['owner profile', 'профиль владельца'],
    ['owner-экран', 'экран владельца'],
    ['task-flow', 'сценарий задач'],
    ['dashboard', 'панель показателей'],
    ['runtime-слой', 'исполняемый слой'],
    ['Accessibility QA', 'Проверка доступности'],
    ['Keyboard-only', 'Только клавиатура'],
    ['Reduced motion', 'Уменьшение движения'],
    ['Screen reader pass', 'Проверка экранным диктором'],
    ['Screen reader', 'Экранный диктор'],
    ['UAT readiness', 'Готовность к приёмочным испытаниям'],
    ['пользовательским UAT', 'пользовательским приёмочным испытаниям'],
    ['North Star', 'Главная метрика'],
    ['Successful Care Journey Rate', 'Доля успешно завершённых маршрутов помощи'],
    ['Performance budget', 'Ограничения производительности'],
    ['Summary', 'Итоги'],
    ['Consent flow', 'Согласование услуг'],
    ['Coverage check', 'Проверка покрытия'],
    ['Server-authoritative queue', 'Очередь под управлением сервера'],
    ['LiveKit track', 'медиапотока'],
    ['OCR confidence', 'Точность распознавания'],
    ['OCR-доверие', 'Достоверность распознавания'],
    ['OCR verified', 'распознавание проверено'],
    ['OCR', 'Распознавание текста'],
    ['ICU', 'реанимация'],
    ['SMS', 'сообщений'],
    ['CTA', 'кнопка действия'],
    ['SLA risk', 'Риск срока ответа'],
    ['SLA Риск', 'Риск срока ответа'],
    ['SLA риск', 'Риск срока ответа'],
    ['SLA', 'срок ответа'],
    ['soft tissue', 'на мягких тканях'],
    ['trust-score', 'оценка доверия'],
    ['care-fit', 'соответствие потребностям'],
    ['stale', 'устарело'],
    ['emergency-сценарии', 'срочном сценарии'],
    ['emergency', 'срочная помощь'],
    ['UI-прототип', 'прототип интерфейса'],
    ['UI', 'интерфейс'],
    ['HD', 'Высокое качество']
  ].sort((a, b) => b[0].length - a[0].length);

  const localizeText = (root = document.body) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement?.closest('script,style,code,svg')) return;
      let value = node.nodeValue;
      replacements.forEach(([from, to]) => { value = value.split(from).join(to); });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
    root.querySelectorAll('[aria-label],[title],[placeholder]').forEach((element) => {
      ['aria-label', 'title', 'placeholder'].forEach((name) => {
        if (!element.hasAttribute(name)) return;
        let value = element.getAttribute(name);
        replacements.forEach(([from, to]) => { value = value.split(from).join(to); });
        element.setAttribute(name, value);
      });
    });
  };

  const setupEmergency = () => {
    const buttons = [...document.querySelectorAll('[data-v42-symptom]')];
    const result = document.querySelector('[data-v42-symptom-result]');
    buttons.forEach((button) => button.addEventListener('click', () => {
      buttons.forEach((item) => item.classList.toggle('is-selected', item === button));
      button.setAttribute('aria-pressed', 'true');
      buttons.filter((item) => item !== button).forEach((item) => item.setAttribute('aria-pressed', 'false'));
      const symptom = button.dataset.v42Symptom;
      if (result) result.innerHTML = `<svg aria-hidden="true" class="vh-icon"><use href="#i-emergency-heart"></use></svg><span><strong>${symptom}: нужен срочный очный маршрут</strong><small>Ниже показаны круглосуточные клиники с подходящими возможностями. Позвоните перед выездом.</small></span>`;
      document.getElementById('v42-emergency-clinics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const live = document.getElementById('vh-live-status');
      if (live) live.textContent = `${symptom}. Показаны клиники для срочного очного маршрута.`;
    }));
  };

  normalizeHeaders();
  localizeText();
  setupEmergency();

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === 'characterData') {
        if (record.target.parentElement) localizeText(record.target.parentElement);
        return;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          const topbar = node.closest('.topbar');
          normalizeHeaders(topbar || node);
          localizeText(node);
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          localizeText(node.parentElement);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
})();
