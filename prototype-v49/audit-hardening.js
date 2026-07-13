/* VetHelp audit hardening — a cohesive prototype state model.
   This keeps the prototype dock intact, but prevents it from creating contradictory UI. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const services = {
    THERAPY_INITIAL: { name: 'Консультация терапевта', shortName: 'Терапевт', price: '1 200 ₽', speciality: 'THERAPIST', duration: '30 минут' },
    SURGERY_INITIAL: { name: 'Консультация хирурга', shortName: 'Хирург', price: '1 800 ₽', speciality: 'SURGEON', duration: '30 минут' },
    DERMATOLOGY: { name: 'Консультация дерматолога', shortName: 'Дерматолог', price: '1 600 ₽', speciality: 'DERMATOLOGIST', duration: '30 минут' },
    CARDIOLOGY: { name: 'Консультация кардиолога', shortName: 'Кардиолог', price: '2 000 ₽', speciality: 'CARDIOLOGIST', duration: '40 минут' },
  };

  const doctors = {
    anna: { id: 'anna', name: 'Анна Смирнова', speciality: 'THERAPIST', label: 'Терапевт', experience: '8 лет', photo: 'vethelp_media/doctor_anna.webp' },
    igor: { id: 'igor', name: 'Игорь Лебедев', speciality: 'SURGEON', label: 'Хирург', experience: '12 лет', photo: 'vethelp_media/doctor_igor.webp' },
    katya: { id: 'katya', name: 'Екатерина Волкова', speciality: 'DERMATOLOGIST', label: 'Дерматолог', experience: '7 лет', photo: 'vethelp_media/doctor_katya.webp' },
    dmitry: { id: 'dmitry', name: 'Дмитрий Орлов', speciality: 'CARDIOLOGIST', label: 'Кардиолог', experience: '10 лет', photo: 'vethelp_media/doctor_dmitry.webp' },
  };

  const initialState = () => ({
    bookingDraft: {
      serviceCode: 'THERAPY_INITIAL',
      doctorId: 'anna',
      date: '2026-06-25',
      time: '12:00',
      slotState: 'AVAILABLE',
    },
    appointment: {
      id: 'demo-appointment-001',
      status: 'MANUAL_CONFIRM_PENDING',
      clinic: 'ВетКлиника+',
      address: 'ул. Ленина, 10',
      pet: 'Барни · Корги · 3 года',
      serviceCode: 'THERAPY_INITIAL',
      doctorId: 'anna',
      date: '2026-06-25',
      time: '12:00',
      originalDate: '2026-06-25',
      originalTime: '12:00',
      deadline: 'Сегодня, 11:45',
      alternatives: [
        { date: '2026-06-25', time: '15:30' },
        { date: '2026-06-26', time: '10:00' },
        { date: '2026-06-26', time: '17:30' },
      ],
    },
    insurance: { status: 'NOT_CHECKED' },
    telemed: { status: 'INTAKE', microphoneEnabled: true, cameraEnabled: true, speakerEnabled: true, source: 'NEW' },
  });

  const state = initialState();
  window.VetHelpPrototypeState = state;

  const message = (text) => {
    const existing = $('.prototype-toast');
    if (existing) {
      existing.textContent = text;
      existing.classList.add('show');
      clearTimeout(window.__vhAuditToast);
      window.__vhAuditToast = setTimeout(() => existing.classList.remove('show'), 3600);
      return;
    }
    window.alert(text);
  };

  const formatDate = (iso, withWeekday = false) => {
    const date = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', ...(withWeekday ? { weekday: 'short' } : {}),
    }).format(date).replace('.', '');
  };

  const dateTime = (date, time) => `${formatDate(date, true)} · ${time}`;
  const getDraftService = () => services[state.bookingDraft.serviceCode];
  const getAppointmentService = () => services[state.appointment.serviceCode];
  const getDraftDoctor = () => doctors[state.bookingDraft.doctorId];
  const getAppointmentDoctor = () => doctors[state.appointment.doctorId];

  const setText = (selector, value, root = document) => {
    const node = $(selector, root);
    if (node) node.textContent = value;
  };

  const navigate = (route) => {
    const target = `#${route}`;
    if (location.hash === target) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      location.hash = target;
    }
  };

  const bookingMetaRows = () => $$('#booking .summary-row');
  const findSummaryRow = (label) => bookingMetaRows().find((row) => row.firstElementChild?.textContent?.trim() === label);

  function renderBooking() {
    const draftService = getDraftService();
    const draftDoctor = getDraftDoctor();
    setText('#booking .topbar .subtitle', `ВетКлиника+ · ${draftService.name}`);
    setText('#booking-time', dateTime(state.bookingDraft.date, state.bookingDraft.time));

    const serviceRow = findSummaryRow('Услуга');
    if (serviceRow?.querySelector('strong')) serviceRow.querySelector('strong').textContent = draftService.name;
    const priceRow = findSummaryRow('Стоимость');
    if (priceRow?.querySelector('strong')) priceRow.querySelector('strong').textContent = draftService.price;

    const context = $$('#booking .context-stop');
    if (context[1]) {
      setText('strong', draftDoctor.name, context[1]);
      setText('small', `${draftDoctor.label} · документы проверены`, context[1]);
      const image = $('img', context[1]);
      if (image) { image.src = draftDoctor.photo; image.alt = draftDoctor.name; }
    }
    const summaryDoctor = $('#booking .summary-doctor');
    if (summaryDoctor) {
      setText('strong', draftDoctor.name, summaryDoctor);
      setText('small', `${draftDoctor.label} · ВетКлиника+`, summaryDoctor);
      const image = $('img', summaryDoctor);
      if (image) { image.src = draftDoctor.photo; image.alt = draftDoctor.name; }
    }

    $$('#booking .day').forEach((button) => {
      const active = button.dataset.date === state.bookingDraft.date;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('#booking .slot').forEach((button) => {
      const active = button.dataset.time === state.bookingDraft.time;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = state.bookingDraft.slotState === 'SLOT_TAKEN' && active;
    });

    renderBookingReview();
    renderDoctorAvailability();
  }

  function renderBookingReview() {
    const service = getDraftService();
    const doctor = getDraftDoctor();
    const review = $('#booking-review');
    if (!review) return;
    setText('.review-visual-card h3', `ВетКлиника+ · ${service.name}`, review);
    setText('.inline-doctor strong', doctor.name, review);
    setText('.inline-doctor small', `${doctor.label} · выбранный специалист`, review);
    const reviewImage = $('.inline-doctor img', review);
    if (reviewImage) { reviewImage.src = doctor.photo; reviewImage.alt = doctor.name; }
    $$('.line-item', review).forEach((row) => {
      const label = row.querySelector('strong')?.textContent?.trim();
      const detail = row.querySelector('small');
      if (!detail) return;
      if (label === 'Услуга') detail.textContent = `${service.name} · ${service.duration}`;
      if (label === 'Дата и время') detail.textContent = dateTime(state.bookingDraft.date, state.bookingDraft.time);
    });
    $$('.review-visual-card .meta-chip', review).forEach((chip) => {
      const text = chip.textContent.trim();
      const label = chip.querySelector('span');
      if (!label) return;
      if (/июня|июля|августа/.test(text)) label.textContent = formatDate(state.bookingDraft.date);
      if (/^\d{2}:\d{2}$/.test(text)) label.textContent = state.bookingDraft.time;
    });
  }

  const appointmentStatusConfig = {
    MANUAL_CONFIRM_PENDING: {
      className: 'status-state--pending',
      pill: 'Клиника подтверждает',
      title: 'Ждём ответ клиники',
      copy: 'Заявка отправлена. Обычно клиника подтверждает время или предлагает замену в течение 15 минут.',
      timeline: [
        ['Заявка отправлена', 'Сегодня, 09:14', 'done'],
        ['Клиника подтверждает время', 'Обычно это занимает до 15 минут', 'current'],
        ['Подтверждение записи', 'Появится после ответа клиники', 'future'],
      ],
      action: { route: 'appointment-detail', label: 'Обновить статус', kind: 'secondary' },
    },
    ALTERNATIVE_PROPOSED: {
      className: 'status-state--pending',
      pill: 'Нужно выбрать время',
      title: 'Клиника предложила альтернативу',
      copy: 'Исходное время больше недоступно. Выберите подходящий вариант; клиника подтвердит его отдельным ответом.',
      timeline: [
        ['Заявка создана', 'Сегодня, 09:14', 'done'],
        ['Предложены новые варианты', `Выберите до ${state.appointment.deadline}`, 'current'],
        ['Подтверждение записи', 'После ответа клиники', 'future'],
      ],
      action: { route: 'alternative-slot', label: 'Выбрать новое время', kind: 'primary' },
    },
    CONFIRMED: {
      className: 'status-state--confirmed',
      pill: 'Запись подтверждена',
      title: 'Визит подтверждён клиникой',
      copy: 'Клиника зафиксировала услугу, врача и время. Перед визитом можно открыть маршрут или добавить событие в календарь.',
      timeline: [
        ['Заявка отправлена', 'Сегодня, 09:14', 'done'],
        ['Клиника подтвердила запись', 'Сегодня, 09:24', 'done'],
        ['Визит запланирован', dateTime(state.appointment.date, state.appointment.time), 'done'],
      ],
      action: { route: 'catalog', label: 'Открыть маршрут', kind: 'primary' },
    },
    SLOT_TAKEN: {
      className: 'status-state--cancelled',
      pill: 'Время недоступно',
      title: 'Выбранный слот уже заняли',
      copy: 'Мы сохранили выбранную услугу и врача. Выберите другое доступное время.',
      timeline: [
        ['Проверка доступности', 'Слот изменился до отправки', 'current'],
        ['Новый выбор времени', 'Нужен ваш выбор', 'future'],
      ],
      action: { route: 'booking', label: 'Выбрать другое время', kind: 'primary' },
    },
    CLINIC_CANCELLED: {
      className: 'status-state--cancelled',
      pill: 'Заявка отменена клиникой',
      title: 'Клиника не может подтвердить визит',
      copy: 'Клиника не смогла принять заявку. Выберите другое время или подходящую клинику.',
      timeline: [
        ['Клиника рассмотрела заявку', 'Сегодня, 09:24', 'done'],
        ['Заявка отменена', 'Клиника не подтвердила доступность', 'current'],
      ],
      action: { route: 'catalog', label: 'Найти другое время', kind: 'primary' },
    },
    PAYMENT_PENDING: {
      className: 'status-state--pending',
      pill: 'Ожидается оплата',
      title: 'Заявка ожидает подтверждения оплаты',
      copy: 'Статус меняется только после ответа платёжного сервиса. До этого времени и запись не считаются окончательно подтверждёнными.',
      timeline: [
        ['Заявка принята', 'Сегодня, 09:14', 'done'],
        ['Ожидаем подтверждение оплаты', 'Не закрывайте страницу до финального статуса', 'current'],
      ],
      action: { route: 'appointment-detail', label: 'Обновить статус', kind: 'secondary' },
    },
  };

  function buildTimeline(items) {
    return `<div class="timeline" aria-label="История статуса">${items.map(([title, copy, kind]) => {
      const itemClass = kind === 'done' ? 'done' : kind === 'future' ? 'muted' : '';
      const dotClass = kind === 'done' ? 'timeline-dot--done' : kind === 'future' ? 'timeline-dot--future' : 'timeline-dot--current';
      const dotLabel = kind === 'done' ? 'Готово' : kind === 'future' ? 'Будущий шаг' : 'Текущий шаг';
      const dotText = kind === 'done' ? '✓' : '';
      return `
      <div class="timeline-item ${itemClass}">
        <span class="timeline-dot ${dotClass}" aria-label="${dotLabel}">${dotText}</span>
        <span class="timeline-copy"><strong>${escapeHtml(title)}</strong><small class="muted">${escapeHtml(copy)}</small></span>
      </div>`;
    }).join('')}</div>`;
  }

  function renderAppointment() {
    const card = $('#appointment-detail .two-col > article:first-child');
    if (!card) return;
    const config = appointmentStatusConfig[state.appointment.status] || appointmentStatusConfig.MANUAL_CONFIRM_PENDING;
    const service = getAppointmentService();
    const doctor = getAppointmentDoctor();
    const isAlternative = state.appointment.status === 'ALTERNATIVE_PROPOSED';
    const hero = $('#appointment-detail .v46-appointment-hero');
    if (hero) {
      const heroState = (() => {
        if (isAlternative) return {
          pill: 'Нужно выбрать время', pillClass: 'orange', kicker: 'Запись пока не подтверждена',
          title: 'Клиника предложила приём в 15:30',
          copy: 'Исходный слот на 12:00 недоступен. Ответьте до 11:45 — после выбора клиника подтвердит запись.',
          primary: 'Выбрать 15:30', route: 'alternative-slot', secondary: 'Другие варианты', secondaryRoute: 'alternative-slot',
        };
        if (state.appointment.status === 'CONFIRMED') return {
          pill: 'Подтверждено', pillClass: 'green', kicker: 'Можно планировать поездку',
          title: 'Запись подтверждена на 12:00', copy: 'Клиника зафиксировала врача, услугу и время. Проверьте маршрут и документы перед выездом.',
          primary: 'Открыть маршрут', route: 'catalog', secondary: 'Добавить в календарь', secondaryRoute: 'appointment-detail',
        };
        if (state.appointment.status === 'CLINIC_CANCELLED' || state.appointment.status === 'SLOT_TAKEN') return {
          pill: 'Нужно выбрать заново', pillClass: 'red', kicker: 'Текущая заявка не подтверждена',
          title: 'Клиника не смогла подтвердить время', copy: 'Контекст питомца и услуги сохранён — выберите другое время или клинику.',
          primary: 'Подобрать время', route: 'catalog', secondary: 'Другие клиники', secondaryRoute: 'catalog',
        };
        return {
          pill: 'Клиника подтверждает', pillClass: 'orange', kicker: 'Заявка отправлена',
          title: 'Ждём подтверждение от клиники', copy: 'Обычно ответ приходит в течение 15 минут. До подтверждения ехать в клинику не нужно.',
          primary: 'Обновить статус', route: 'appointment-detail', secondary: 'Отменить заявку', secondaryRoute: null,
        };
      })();
      hero.dataset.appointmentState = state.appointment.status;
      hero.innerHTML = `
        <div class="v46-appointment-hero__main"><span class="pill ${heroState.pillClass}">${escapeHtml(heroState.pill)}</span><span class="kicker">${escapeHtml(heroState.kicker)}</span><h2 id="v46-appointment-title">${escapeHtml(heroState.title)}</h2><p>${escapeHtml(heroState.copy)}</p></div>
        <dl class="v46-appointment-facts"><div><dt>Дата</dt><dd>${escapeHtml(dateTime(state.appointment.date, state.appointment.time))}</dd></div><div><dt>Питомец</dt><dd>Барни</dd></div><div><dt>Клиника</dt><dd>${escapeHtml(state.appointment.clinic)}</dd></div></dl>
        <div class="v46-appointment-actions"><a class="btn" data-v35-touch-target="checked" href="#${heroState.route}">${escapeHtml(heroState.primary)}</a>${heroState.secondaryRoute ? `<a class="btn secondary" data-v35-touch-target="checked" href="#${heroState.secondaryRoute}">${escapeHtml(heroState.secondary)}</a>` : `<button class="btn secondary" data-appointment-cancel-hero type="button">${escapeHtml(heroState.secondary)}</button>`}<a class="section-link" data-v35-touch-target="checked" href="#catalog">Другая клиника</a></div>`;
    }
    const facts = isAlternative
      ? [
          ['Исходное время', `${dateTime(state.appointment.originalDate, state.appointment.originalTime)} · недоступно`],
          ['Клиника', `${state.appointment.clinic} · ${state.appointment.address}`],
          ['Питомец', state.appointment.pet],
          ['Приём', `${service.shortName} · ${doctor.name}`],
        ]
      : [
          ['Клиника', `${state.appointment.clinic} · ${state.appointment.address}`],
          ['Дата и время', dateTime(state.appointment.date, state.appointment.time)],
          ['Питомец', state.appointment.pet],
          ['Приём', `${service.shortName} · ${doctor.name}`],
        ];

    card.innerHTML = `
      <section class="appointment-state-panel ${config.className}" aria-live="polite">
        <div class="section-header">
          <div>
            <span class="pill ${state.appointment.status === 'CONFIRMED' ? 'green' : state.appointment.status.includes('CANCEL') || state.appointment.status === 'SLOT_TAKEN' ? 'red' : 'orange'}">${escapeHtml(config.pill)}</span>
            <h2>${escapeHtml(config.title)}</h2>
          </div>
        </div>
        <p class="status-state-copy">${escapeHtml(config.copy)}</p>
        ${buildTimeline(config.timeline)}
        <dl class="status-state__facts">${facts.map(([label, value]) => `<div class="status-state__fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        <div class="status-state__actions">
          <a class="btn ${config.action.kind === 'secondary' ? 'secondary' : ''}" href="#${config.action.route}" data-appointment-primary-action>${escapeHtml(config.action.label)}</a>
          ${state.appointment.status === 'MANUAL_CONFIRM_PENDING' ? '<button class="btn secondary" type="button" data-appointment-cancel>Отменить заявку</button>' : ''}
        </div>
      </section>`;

    $('[data-appointment-cancel]', card)?.addEventListener('click', () => {
      state.appointment.status = 'CLINIC_CANCELLED';
      renderAppointment();
      message('Заявка отменена. Вы можете выбрать другое время или клинику.');
    });
    hero?.querySelector('[data-appointment-cancel-hero]')?.addEventListener('click', () => {
      state.appointment.status = 'CLINIC_CANCELLED';
      renderAppointment();
      message('Заявка отменена. Вы можете выбрать другое время или клинику.');
    });
  }

  function renderAlternatives() {
    const page = $('#alternative-slot');
    if (!page) return;
    const target = $('.glass.pad', page);
    if (!target) return;
    const service = getAppointmentService();
    const doctor = getAppointmentDoctor();
    const options = state.appointment.alternatives.map((option, index) => {
      const optionDate = new Date(`${option.date}T12:00:00`);
      const optionDay = optionDate.getDate();
      const optionMonth = formatDate(option.date).replace(/^\d+\s+/, '');
      const optionWeekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(optionDate).replace('.', '');
      return `
      <button class="glass hoverable alt-slot" type="button" data-alternative-index="${index}" aria-pressed="false" role="radio" aria-checked="false" aria-label="Выбрать время ${escapeHtml(optionDay)} ${escapeHtml(optionMonth)}, ${escapeHtml(option.time)}. ${escapeHtml(optionWeekday)}, ${escapeHtml(service.name)}, ${escapeHtml(service.duration)}, ${escapeHtml(doctor.name)}">
        <span class="alt-date"><b>${escapeHtml(optionDay)}</b><small>${escapeHtml(optionMonth)}</small></span>
        <span class="alt-slot-copy"><strong>${escapeHtml(option.time)}</strong><small class="muted">${escapeHtml(optionWeekday)} · ${escapeHtml(service.name)} · ${escapeHtml(service.duration)} · ${escapeHtml(doctor.name)}</small></span>
        <span class="alt-slot-chevron" aria-hidden="true">›</span>
      </button>`;
    }).join('');
    target.innerHTML = `
      <div class="kicker">Предложение клиники</div>
      <h2 class="u-mt-7">Выберите другое время</h2>
      <div class="alternative-context"><span><strong>Исходная заявка</strong><small>${escapeHtml(dateTime(state.appointment.originalDate, state.appointment.originalTime))} · ${escapeHtml(service.name)}</small></span><span class="pill orange">Время больше недоступно</span></div>
      <p class="muted">Новый вариант отправится клинике на подтверждение. Интерфейс не считает запись подтверждённой до ответа клиники.</p>
      <div class="alt-slots u-mt-15">${options}</div>
      <div class="alternative-help"><div><strong>Подходящего времени нет?</strong><small>Вернитесь к каталогу или свяжитесь с клиникой.</small></div><div class="alternative-help-actions"><a class="btn secondary" href="#catalog">К каталогу</a></div></div>`;
    $$('[data-alternative-index]', target).forEach((button) => button.addEventListener('click', () => {
      const option = state.appointment.alternatives[Number(button.dataset.alternativeIndex)];
      if (!option) return;
      state.appointment.date = option.date;
      state.appointment.time = option.time;
      state.appointment.status = 'MANUAL_CONFIRM_PENDING';
      renderAppointment();
      renderBooking();
      message('Выбранный вариант отправлен клинике на подтверждение.');
      navigate('appointment-detail');
    }));
  }

  function renderDoctorAvailability() {
    const selectedService = getDraftService();
    $$('#doctor-select .provider-card').forEach((card) => {
      const id = card.dataset.doctorId;
      const doctor = doctors[id];
      if (!doctor) return;
      const allowed = doctor.speciality === selectedService.speciality;
      card.classList.toggle('selected', id === state.bookingDraft.doctorId);
      card.classList.toggle('is-referral-only', !allowed);
      card.setAttribute('aria-disabled', String(!allowed));
      card.tabIndex = allowed ? 0 : -1;
      card.setAttribute('aria-label', `${doctor.name}, ${doctor.label}${allowed ? ', доступен для выбранной услуги' : ', недоступен для выбранной услуги'}`);
    });
    setText('#doctor-select .topbar .subtitle', `Выберите специалиста для услуги «${selectedService.name}».`);
  }

  function installBookingControls() {
    const booking = $('#booking');
    if (!booking) return;
    const dateStrip = $('.date-strip', booking);
    if (dateStrip) {
      $$('.day', dateStrip).forEach((node) => {
        const day = node.textContent.match(/\d+/)?.[0];
        if (!day) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = node.className;
        button.dataset.date = `2026-06-${day.padStart(2, '0')}`;
        button.setAttribute('aria-label', formatDate(button.dataset.date));
        button.setAttribute('aria-pressed', String(node.classList.contains('active')));
        button.innerHTML = node.innerHTML;
        node.replaceWith(button);
      });
      $$('.day', dateStrip).forEach((button) => button.addEventListener('click', () => {
        state.bookingDraft.date = button.dataset.date;
        state.bookingDraft.slotState = 'AVAILABLE';
        renderBooking();
      }));
    }

    const serviceCard = $('.booking-layout > article:first-child', booking);
    if (serviceCard && !$('#booking-service-select', serviceCard)) {
      const field = document.createElement('label');
      field.className = 'booking-service-field';
      field.innerHTML = `<span>Услуга</span><select id="booking-service-select" class="vh-design-select" aria-describedby="booking-service-hint">${Object.entries(services).map(([code, service]) => `<option value="${code}">${escapeHtml(service.name)} · ${escapeHtml(service.price)}</option>`).join('')}</select><small id="booking-service-hint">Доступны только врачи соответствующей специальности.</small>`;
      dateStrip?.before(field);
      const select = $('#booking-service-select', field);
      select.value = state.bookingDraft.serviceCode;
      select.addEventListener('change', () => {
        state.bookingDraft.serviceCode = select.value;
        const target = services[select.value];
        const compatible = Object.values(doctors).find((doctor) => doctor.speciality === target.speciality);
        if (compatible) state.bookingDraft.doctorId = compatible.id;
        renderBooking();
      });
    }

    const slotGrid = $('.slot-grid', booking);
    if (slotGrid) {
      $$('.slot', slotGrid).forEach((node) => {
        const button = node.cloneNode(true);
        button.type = 'button';
        button.dataset.time = node.dataset.slot || node.textContent.trim();
        button.setAttribute('aria-pressed', String(node.classList.contains('selected')));
        node.replaceWith(button);
      });
      $$('.slot', slotGrid).forEach((button) => button.addEventListener('click', () => {
        if (button.disabled) {
          message('Это время уже недоступно. Выберите другой слот.');
          return;
        }
        state.bookingDraft.time = button.dataset.time;
        state.bookingDraft.slotState = 'AVAILABLE';
        renderBooking();
        message(`Выбрано ${formatDate(state.bookingDraft.date)}, ${state.bookingDraft.time}. Доступность подтвердит клиника.`);
      }));
    }
  }

  function installDoctorControls() {
    const map = [
      ['Анна Смирнова', 'anna'], ['Игорь Лебедев', 'igor'], ['Екатерина Волкова', 'katya'], ['Дмитрий Орлов', 'dmitry'],
    ];
    $$('#doctor-select .provider-card').forEach((card) => {
      const id = map.find(([name]) => card.textContent.includes(name))?.[1];
      if (!id) return;
      card.dataset.doctorId = id;
      card.addEventListener('click', (event) => {
        event.preventDefault();
        const doctor = doctors[id];
        const service = getDraftService();
        if (doctor.speciality !== service.speciality) {
          message(`Для услуги «${service.name}» доступен только врач соответствующей специальности.`);
          return;
        }
        state.bookingDraft.doctorId = id;
        renderBooking();
        navigate('booking');
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
    });
  }

  function installBookingSubmit() {
    const submit = $('#booking-review a[href="#appointment-detail"]');
    if (!submit) return;
    const clone = submit.cloneNode(true);
    clone.setAttribute('data-submit-booking', 'true');
    submit.replaceWith(clone);
    clone.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.bookingDraft.slotState !== 'AVAILABLE') {
        state.appointment.status = 'SLOT_TAKEN';
      } else {
        state.appointment = {
          ...state.appointment,
          status: 'MANUAL_CONFIRM_PENDING',
          serviceCode: state.bookingDraft.serviceCode,
          doctorId: state.bookingDraft.doctorId,
          date: state.bookingDraft.date,
          time: state.bookingDraft.time,
          originalDate: state.bookingDraft.date,
          originalTime: state.bookingDraft.time,
        };
      }
      renderAppointment();
      message('Заявка отправлена в клинику. Статус обновится после ответа клиники.');
      navigate('appointment-detail');
    });
  }

  function renderInsurance() {
    const result = $('#insurance [data-coverage-result]');
    const action = $('#insurance [data-coverage-action]');
    if (!result || !action) return;
    const title = $('strong', result);
    const copy = $('small', result);
    const dot = $('.result-dot', result);
    const wording = {
      NOT_CHECKED: ['Проверка ещё не запускалась', 'Выберите услугу и клинику; результат не является гарантией оплаты.', 'Запустить предварительную проверку'],
      CHECK_PENDING: ['Проверяем условия полиса', 'Статус появится только после ответа страховщика или запроса документов.', 'Проверяем…'],
      NEEDS_DOCUMENTS: ['Нужны документы для предварительного решения', 'Прототип не обращается к страховщику. В сервисе потребуется ответ партнёра и, при необходимости, документы.', 'Повторить проверку'],
      INSURER_UNAVAILABLE: ['Страховщик временно недоступен', 'Сохраните контекст визита и повторите проверку позже. Не обещайте покрытие владельцу.', 'Повторить проверку'],
    }[state.insurance.status];
    if (title) title.textContent = wording[0];
    if (copy) copy.textContent = wording[1];
    if (dot) dot.classList.toggle('ready', state.insurance.status === 'NEEDS_DOCUMENTS');
    action.textContent = wording[2];
    action.disabled = state.insurance.status === 'CHECK_PENDING';
    action.setAttribute('aria-busy', String(state.insurance.status === 'CHECK_PENDING'));
  }

  function installInsuranceControl() {
    const current = $('#insurance [data-coverage-action]');
    if (!current) return;
    const action = current.cloneNode(true);
    current.replaceWith(action);
    action.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.insurance.status === 'CHECK_PENDING') return;
      state.insurance.status = 'CHECK_PENDING';
      renderInsurance();
      window.setTimeout(() => {
        state.insurance.status = 'NEEDS_DOCUMENTS';
        renderInsurance();
        message('Нужны документы или ответ страховщика. Покрытие не подтверждено.');
      }, 650);
    });
  }

  function installTelemedControls() {
    // Historical summary remains reachable from a completed past consultation.
    $$('#telemed a[href="#telemed-summary"]').forEach((link) => link.addEventListener('click', () => {
      state.telemed.status = 'COMPLETED';
      state.telemed.source = 'HISTORY';
    }));

    $$('#telemed-check a[href="#telemed-wait"]').forEach((link) => link.addEventListener('click', () => {
      state.telemed.status = 'WAITING_DOCTOR';
    }));

    // In the prototype this button represents the server-confirmed "doctor joined" event.
    // It is intentionally a button, not a deep-link that bypasses the call state guard.
    const waitingEntry = $('#telemed-wait a[href="#telemed-call"], #telemed-wait .waiting-join-disabled');
    if (waitingEntry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn full waiting-join';
      button.textContent = 'Войти в видеозвонок';
      button.setAttribute('aria-describedby', 'telemed-entry-note');
      waitingEntry.replaceWith(button);
      let note = $('#telemed-entry-note');
      if (!note) {
        note = document.createElement('p');
        note.id = 'telemed-entry-note';
        note.className = 'muted small';
        note.textContent = 'Кнопка становится доступной после подтверждённого подключения врача.';
        button.after(note);
      }
      button.addEventListener('click', () => {
        state.telemed.status = 'IN_CALL';
        navigate('telemed-call');
      });
    }

    const call = $('#telemed-call');
    const controls = $('.call-controls', call);
    if (!call || !controls) return;

    const createControl = (key, icon, pressed, label, extra = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `call-control ${extra}`.trim();
      button.dataset.callControl = key;
      if (typeof pressed === 'boolean') button.setAttribute('aria-pressed', String(pressed));
      button.setAttribute('aria-label', label);
      button.innerHTML = `<svg aria-hidden="true" class="vh-icon" focusable="false"><use href="#i-${icon}"></use></svg>`;
      return button;
    };

    controls.innerHTML = '';
    controls.append(
      createControl('microphone', 'mic', true, 'Выключить микрофон'),
      createControl('camera', 'video', true, 'Выключить камеру'),
      createControl('switch-camera', 'camera-switch', null, 'Сменить камеру'),
      createControl('speaker', 'speaker', true, 'Выключить динамик'),
      createControl('chat', 'chat', null, 'Открыть чат'),
      createControl('end-call', 'end-call', null, 'Завершить разговор', 'end'),
    );

    let feedback = $('.telemed-call-feedback', call);
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.className = 'telemed-call-feedback';
      feedback.setAttribute('aria-live', 'polite');
      feedback.hidden = true;
      controls.after(feedback);
    }

    const updateControl = (button, on, onIcon, offIcon, onLabel, offLabel, offClass) => {
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', on ? onLabel : offLabel);
      button.classList.toggle(offClass, !on);
      const use = $('use', button);
      if (use) use.setAttribute('href', `#i-${on ? onIcon : offIcon}`);
    };

    $$('[data-call-control]', controls).forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.callControl;
      if (key === 'microphone') {
        state.telemed.microphoneEnabled = !state.telemed.microphoneEnabled;
        updateControl(button, state.telemed.microphoneEnabled, 'mic', 'mic-off', 'Выключить микрофон', 'Включить микрофон', 'is-muted');
      }
      if (key === 'camera') {
        state.telemed.cameraEnabled = !state.telemed.cameraEnabled;
        updateControl(button, state.telemed.cameraEnabled, 'video', 'video-off', 'Выключить камеру', 'Включить камеру', 'is-camera-off');
      }
      if (key === 'speaker') {
        state.telemed.speakerEnabled = !state.telemed.speakerEnabled;
        updateControl(button, state.telemed.speakerEnabled, 'speaker', 'speaker', 'Выключить динамик', 'Включить динамик', 'is-muted');
      }
      if (key === 'switch-camera') {
        feedback.hidden = false;
        feedback.textContent = 'Камера переключается…';
        window.setTimeout(() => { feedback.textContent = 'Камера переключена.'; }, 400);
      }
      if (key === 'chat') {
        feedback.hidden = false;
        feedback.textContent = 'Чат доступен в рабочей сессии после подключения к серверу.';
      }
      if (key === 'end-call') {
        state.telemed.status = 'COMPLETED';
        state.telemed.source = 'LIVE';
        navigate('telemed-summary');
      }
    }));

    const reconnect = $('.call-secondary .status-chip', call);
    if (reconnect?.tagName === 'A') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = reconnect.className;
      button.innerHTML = reconnect.innerHTML;
      button.setAttribute('aria-label', 'Переподключиться к звонку');
      reconnect.replaceWith(button);
      button.addEventListener('click', () => {
        feedback.hidden = false;
        feedback.textContent = 'Проверяем соединение…';
        window.setTimeout(() => { feedback.textContent = 'Соединение восстановлено.'; }, 600);
      });
    }
  }

  function applyRouteGuard() {
    const route = (location.hash || '#home').slice(1);
    const fallback = (() => {
      if (route === 'alternative-slot' && state.appointment.status !== 'ALTERNATIVE_PROPOSED') return 'appointment-detail';
      if (route === 'telemed-call' && state.telemed.status !== 'IN_CALL') return 'telemed-wait';
      if (route === 'telemed-summary' && state.telemed.status !== 'COMPLETED') return 'telemed';
      return null;
    })();
    if (fallback) {
      history.replaceState(null, '', `#${fallback}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      message('Этот экран доступен после соответствующего подтверждённого шага.');
    }
  }

  function bindDemoDockToState() {
    $$('.prototype-state-actions [data-prototype-state]').forEach((button) => {
      button.addEventListener('click', () => {
        window.setTimeout(() => {
          const demo = button.dataset.prototypeState;
          if (demo === 'reset') {
            const reset = initialState();
            Object.assign(state.bookingDraft, reset.bookingDraft);
            Object.assign(state.appointment, reset.appointment);
            Object.assign(state.insurance, reset.insurance);
            Object.assign(state.telemed, reset.telemed);
          }
          if (demo === 'slot') { state.bookingDraft.slotState = 'SLOT_TAKEN'; state.appointment.status = 'SLOT_TAKEN'; }
          if (demo === 'alternative') state.appointment.status = 'ALTERNATIVE_PROPOSED';
          if (demo === 'clinic-cancel') state.appointment.status = 'CLINIC_CANCELLED';
          if (demo === 'confirmed') state.appointment.status = 'CONFIRMED';
          if (demo === 'payment-pending') state.appointment.status = 'PAYMENT_PENDING';
          if (demo === 'doctor-late') state.telemed.status = 'WAITING_DOCTOR';
          renderBooking();
          renderAppointment();
          renderAlternatives();
          renderInsurance();
          // The legacy dock listener navigates before our state update. Re-navigate only after the authoritative demo state exists.
          if (demo === 'alternative') navigate('alternative-slot');
          if (demo === 'doctor-late') navigate('telemed-wait');
          applyRouteGuard();
        }, 0);
      });
    });
  }

  function markExportScope() {
    // Export only leaf explanatory notes. Never mark a structural container because its descendant copy happens to mention a prototype.
    const selectors = 'p, small, .empty-note, .media-note, .booking-request-note, .waiting-cancel-note';
    $$(selectors).forEach((node) => {
      const copy = node.textContent?.trim() || '';
      const nestedSemanticBlock = node.querySelector('p, small, .empty-note, .media-note, .booking-request-note, .waiting-cancel-note');
      if (!nestedSemanticBlock && /в проде|server-side|server snapshot|демо-состояние прототипа|prototype/i.test(copy)) {
        node.setAttribute('data-export', 'internal');
      }
    });
  }

  installBookingControls();
  installDoctorControls();
  installBookingSubmit();
  installInsuranceControl();
  installTelemedControls();
  bindDemoDockToState();
  markExportScope();
  window.VetHelpPrototypeRender = Object.freeze({
    renderBooking,
    renderAppointment,
    renderAlternatives,
    renderInsurance,
    applyRouteGuard,
    navigate,
  });

  renderBooking();
  renderAppointment();
  renderAlternatives();
  renderInsurance();
  applyRouteGuard();
  window.addEventListener('hashchange', () => window.setTimeout(applyRouteGuard, 0));
})();
