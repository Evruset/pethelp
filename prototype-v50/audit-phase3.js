/* VetHelp audit hardening phase 3 — consistent action states and keyboard-complete flows. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = window.VetHelpPrototypeState;
  const renderer = window.VetHelpPrototypeRender;
  if (!state || !renderer) return;

  const services = {
    THERAPY_INITIAL: { name: 'Консультация терапевта', category: 'Терапия' },
    SURGERY_INITIAL: { name: 'Консультация хирурга', category: 'Хирургия' },
    DERMATOLOGY: { name: 'Консультация дерматолога', category: 'Дерматология' },
    CARDIOLOGY: { name: 'Консультация кардиолога', category: 'Кардиология' },
  };
  const doctors = {
    anna: { name: 'Анна Смирнова', label: 'Терапевт' },
    igor: { name: 'Игорь Лебедев', label: 'Хирург' },
    katya: { name: 'Екатерина Волкова', label: 'Дерматолог' },
    dmitry: { name: 'Дмитрий Орлов', label: 'Кардиолог' },
  };
  const status = {
    MANUAL_CONFIRM_PENDING: { pill: 'Клиника подтверждает', pillClass: 'orange', headline: 'Клиника подтверждает запись', next: 'Откройте запись, чтобы увидеть следующий шаг.' },
    ALTERNATIVE_PROPOSED: { pill: 'Нужно выбрать время', pillClass: 'orange', headline: 'Нужно выбрать другое время', next: 'Клиника предложила альтернативные варианты.' },
    CONFIRMED: { pill: 'Подтверждено', pillClass: 'green', headline: 'Запись подтверждена', next: 'Проверьте маршрут и подготовьте документы.' },
    SLOT_TAKEN: { pill: 'Время недоступно', pillClass: 'red', headline: 'Выберите другое время', next: 'Выбранный слот больше недоступен.' },
    CLINIC_CANCELLED: { pill: 'Заявка отменена', pillClass: 'red', headline: 'Заявка отменена', next: 'Выберите другой слот или клинику.' },
    PAYMENT_PENDING: { pill: 'Ожидается оплата', pillClass: 'orange', headline: 'Ожидается подтверждение оплаты', next: 'Финальный статус появится после подтверждённого ответа.' },
  };

  const isoDate = (value) => new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
    .format(new Date(`${value}T12:00:00`)).replace('.', '');
  const dateTime = (date, time) => `${isoDate(date)} · ${time}`;

  function announce(text, tone = 'info', persistent = false) {
    let node = $('#vh-action-announcer');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vh-action-announcer';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.append(node);
    }
    node.hidden = false;
    node.dataset.tone = tone;
    node.textContent = text;
    clearTimeout(window.__vhActionAnnouncerTimeout);
    if (!persistent) {
      window.__vhActionAnnouncerTimeout = window.setTimeout(() => { node.hidden = true; }, 4600);
    }
  }

  function withBusy(control, busyLabel, task) {
    if (!control || control.dataset.vhBusy === 'true') return;
    const previous = control.textContent;
    const previousTabIndex = control.getAttribute('tabindex');
    control.dataset.vhBusy = 'true';
    control.dataset.vhPreviousText = previous;
    control.textContent = busyLabel;
    control.setAttribute('aria-busy', 'true');
    control.setAttribute('aria-disabled', 'true');
    if ('disabled' in control) control.disabled = true;
    else control.setAttribute('tabindex', '-1');

    Promise.resolve()
      .then(task)
      .finally(() => {
        control.dataset.vhBusy = 'false';
        control.textContent = previous;
        control.removeAttribute('aria-busy');
        control.removeAttribute('aria-disabled');
        if ('disabled' in control) control.disabled = false;
        else if (previousTabIndex === null) control.removeAttribute('tabindex');
        else control.setAttribute('tabindex', previousTabIndex);
      });
  }

  function refreshAll() {
    renderer.renderBooking();
    renderer.renderAppointment();
    renderer.renderAlternatives();
    renderer.renderInsurance();
    window.setTimeout(() => {
      syncMirrors();
      decorateAlternativeFlow();
      syncWaitingRoom();
      bindKeyboardRadios();
      addFreshnessNote();
    }, 0);
  }

  function syncMirrors() {
    const config = status[state.appointment.status] || status.MANUAL_CONFIRM_PENDING;
    const service = services[state.appointment.serviceCode] || services.THERAPY_INITIAL;
    const doctor = doctors[state.appointment.doctorId] || doctors.anna;

    const next = $('#home .next-card');
    if (next) {
      $('.next-title', next)?.replaceChildren(config.headline);
      $('.next-top .muted', next)?.replaceChildren(`${dateTime(state.appointment.date, state.appointment.time)} · ${state.appointment.clinic}`);
      const pill = $('.next-top .pill', next);
      if (pill) {
        pill.className = `pill ${config.pillClass}`;
        pill.textContent = config.pill;
      }
      let action = $('.next-action-owner', next);
      if (!action) {
        action = document.createElement('p');
        action.className = 'next-action-owner';
        $('.status-list', next)?.after(action);
      }
      action.textContent = config.next;
    }

    const primaryCard = $('#appointments .appointment-card[href="#appointment-detail"]');
    if (primaryCard) {
      const pills = $$('.appt-topline .pill', primaryCard);
      const statePill = pills.at(-1);
      if (statePill) {
        statePill.className = `pill ${config.pillClass}`;
        statePill.textContent = config.pill;
      }
      $('h3', primaryCard)?.replaceChildren(service.name);
      $('.appt-main > .muted.small', primaryCard)?.replaceChildren(`${dateTime(state.appointment.date, state.appointment.time)} · ${state.appointment.clinic}`);
      const meta = $('.appt-meta .meta-chip span', primaryCard);
      if (meta) meta.textContent = service.category;
      primaryCard.setAttribute('aria-label', `${service.name}. ${dateTime(state.appointment.date, state.appointment.time)}. ${config.pill}. Открыть детали записи.`);
    }

    const target = $('#appointments .section-header + .info-list');
    if (target) {
      const copy = `Статус «${config.pill}» показан по текущему демонстрационному состоянию. В рабочем сервисе он должен поступать только из server-authoritative snapshot.`;
      let note = $('#appointments .owner-status-mirror');
      if (!note) {
        note = document.createElement('p');
        note.className = 'vh-inline-feedback owner-status-mirror';
        note.dataset.export = 'exclude';
        target.before(note);
      }
      if (note.textContent !== copy) note.textContent = copy;
    }
  }

  function addFreshnessNote() {
    $('#appointment-detail .vh-data-freshness')?.remove();
  }

  function selectedAlternative() {
    const selected = Number(state.appointment.selectedAlternativeIndex);
    return Number.isInteger(selected) && selected >= 0 ? state.appointment.alternatives[selected] : null;
  }

  function decorateAlternativeFlow() {
    const page = $('#alternative-slot');
    const slots = $('.alt-slots', page);
    if (!slots) return;
    slots.setAttribute('role', 'radiogroup');
    slots.setAttribute('aria-label', 'Выбор альтернативного времени');
    $$('[data-alternative-index]', slots).forEach((button) => {
      const selected = Number(button.dataset.alternativeIndex) === Number(state.appointment.selectedAlternativeIndex);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(selected));
      button.setAttribute('aria-pressed', String(selected));
    });

    let submit = $('.vh-alternative-submit', page);
    if (!submit) {
      submit = document.createElement('section');
      submit.className = 'vh-alternative-submit';
      submit.setAttribute('aria-live', 'polite');
      slots.after(submit);
    }
    const option = selectedAlternative();
    const signature = option ? `${option.date}|${option.time}` : 'none';
    if (submit.dataset.signature === signature) return;
    submit.dataset.signature = signature;
    if (option) {
      submit.innerHTML = `<h3>Выбрано новое время</h3><p>${dateTime(option.date, option.time)}. Клиника должна подтвердить вариант отдельным ответом.</p><button class="btn full" type="button" data-submit-alternative>Отправить выбор клинике</button>`;
    } else {
      submit.innerHTML = '<h3>Выберите один вариант</h3><p>Сначала выберите удобное время. Заявка не отправляется автоматически.</p><button class="btn full" type="button" disabled aria-disabled="true">Отправить выбор клинике</button>';
    }
  }

  function syncWaitingRoom() {
    const page = $('#telemed-wait');
    const join = $('.waiting-join', page);
    if (!page || !join) return;
    const ready = state.telemed.status === 'DOCTOR_JOINED';
    join.disabled = !ready;
    join.setAttribute('aria-disabled', String(!ready));
    join.textContent = ready ? 'Войти в видеозвонок' : 'Ожидаем подключения врача';

    let note = $('.vh-waiting-status', page);
    if (!note) {
      note = document.createElement('div');
      note.className = 'vh-waiting-status';
      note.setAttribute('role', 'status');
      $('.waiting-join', page)?.after(note);
    }
    note.dataset.ready = String(ready);
    const copy = ready
      ? 'Врач подтвердил подключение. Теперь можно войти в видеозвонок.'
      : 'Вход в звонок заблокирован до подтверждённого подключения врача. Это состояние не должно определяться локальным таймером.';
    if (note.textContent !== copy) note.textContent = copy;
  }

  function addDoctorJoinedDemoControl() {
    const actions = $('.prototype-state-actions');
    if (!actions || $('[data-prototype-state="doctor-joined"]', actions)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prototype-state-btn';
    button.dataset.prototypeState = 'doctor-joined';
    button.textContent = 'Врач подключился';
    actions.append(button);
  }

  function bindKeyboardRadios() {
    $$('[role="radiogroup"]').forEach((group) => {
      if (group.dataset.vhKeyboardBound === 'true') return;
      group.dataset.vhKeyboardBound = 'true';
      group.addEventListener('keydown', (event) => {
        const radios = $$('[role="radio"]', group).filter((item) => !item.disabled && item.getAttribute('aria-disabled') !== 'true');
        const current = event.target.closest('[role="radio"]');
        if (!current || !radios.length) return;
        const index = radios.indexOf(current);
        let nextIndex = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % radios.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + radios.length) % radios.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = radios.length - 1;
        if (nextIndex !== null) {
          event.preventDefault();
          radios[nextIndex].focus();
          radios[nextIndex].click();
        }
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          current.click();
        }
      });
    });
  }

  function processBookingSubmit(control) {
    withBusy(control, 'Отправляем…', async () => {
      announce('Проверяем выбранные услугу, врача и время. Запись ещё не подтверждена.', 'info', true);
      await new Promise((resolve) => setTimeout(resolve, 520));
      if (state.bookingDraft.slotState !== 'AVAILABLE') {
        state.appointment.status = 'SLOT_TAKEN';
        announce('Выбранное время уже недоступно. Выберите другой слот.', 'warning');
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
        announce('Заявка отправлена. Клиника должна подтвердить время отдельным ответом.', 'success');
      }
      refreshAll();
      renderer.navigate('appointment-detail');
    });
  }

  function processAlternativeSubmit(control) {
    const option = selectedAlternative();
    if (!option) return;
    withBusy(control, 'Отправляем…', async () => {
      announce('Отправляем выбранный вариант клинике. Исходный слот не считается автоматически подтверждённым.', 'info', true);
      await new Promise((resolve) => setTimeout(resolve, 520));
      state.appointment.date = option.date;
      state.appointment.time = option.time;
      state.appointment.status = 'MANUAL_CONFIRM_PENDING';
      delete state.appointment.selectedAlternativeIndex;
      refreshAll();
      renderer.navigate('appointment-detail');
      announce('Новый вариант отправлен клинике на подтверждение.', 'success');
    });
  }

  function processStatusRefresh(control) {
    withBusy(control, 'Проверяем…', async () => {
      await new Promise((resolve) => setTimeout(resolve, 420));
      refreshAll();
      announce('Нового подтверждённого обновления нет. В production этот ответ должен прийти от backend.', 'info');
    });
  }

  function handleClick(event) {
    const alternative = event.target.closest('[data-alternative-index]');
    if (alternative) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.appointment.selectedAlternativeIndex = Number(alternative.dataset.alternativeIndex);
      decorateAlternativeFlow();
      bindKeyboardRadios();
      announce('Время выбрано. Отправьте выбор клинике отдельной кнопкой.', 'info');
      return;
    }

    const submitAlternative = event.target.closest('[data-submit-alternative]');
    if (submitAlternative) {
      event.preventDefault();
      event.stopImmediatePropagation();
      processAlternativeSubmit(submitAlternative);
      return;
    }

    const submitBooking = event.target.closest('[data-submit-booking]');
    if (submitBooking) {
      event.preventDefault();
      event.stopImmediatePropagation();
      processBookingSubmit(submitBooking);
      return;
    }

    const refresh = event.target.closest('[data-appointment-primary-action]');
    if (refresh && /обновить статус/i.test(refresh.textContent)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      processStatusRefresh(refresh);
      return;
    }

    const doctorJoined = event.target.closest('[data-prototype-state="doctor-joined"]');
    if (doctorJoined) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.telemed.status = 'DOCTOR_JOINED';
      syncWaitingRoom();
      announce('Демо-событие: врач подключился. Вход в видеозвонок стал доступен.', 'success');
      return;
    }
  }

  function bindWaitingJoin() {
    const join = $('#telemed-wait .waiting-join');
    if (!join || join.dataset.vhJoinedBound === 'true') return;
    join.dataset.vhJoinedBound = 'true';
    join.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.telemed.status !== 'DOCTOR_JOINED') {
        announce('Подключение врача ещё не подтверждено.', 'warning');
        return;
      }
      state.telemed.status = 'IN_CALL';
      renderer.navigate('telemed-call');
    });
  }


  function init() {
    addDoctorJoinedDemoControl();
    document.addEventListener('click', handleClick, true);
    window.addEventListener('hashchange', () => {
      const banner = $('#vh-action-announcer');
      if (banner) banner.hidden = true;
      window.setTimeout(() => {
        syncMirrors();
        decorateAlternativeFlow();
        syncWaitingRoom();
        bindWaitingJoin();
        bindKeyboardRadios();
        addFreshnessNote();
      }, 0);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-prototype-state]')) return;
      window.setTimeout(() => {
        syncMirrors();
        decorateAlternativeFlow();
        syncWaitingRoom();
        bindWaitingJoin();
        bindKeyboardRadios();
        addFreshnessNote();
      }, 0);
    });
    refreshAll();
    bindWaitingJoin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
