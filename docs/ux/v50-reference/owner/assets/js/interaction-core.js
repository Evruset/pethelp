
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const live = $('#vh-live-status');
  const announce = (msg) => { if (live) live.textContent = msg; };

  // Crisis UX: critical tiles bypass questionnaire, disable telemed and open verified ICU/ORIT map.
  const triggerEmergency = (symptom) => {
    document.body.dataset.emergencyTriage = 'critical';
    const map = $('#emergency-orit-map');
    const sticky = $('#v36rf-emergency-sticky');
    if (map) map.hidden = false;
    if (sticky) sticky.hidden = false;
    const triage = $('#triage-questions');
    if (triage) triage.dataset.skipped = 'true';
    const telemed = $('#telemed');
    if (telemed) telemed.classList.add('v36rf-hidden-by-triage');
    announce(`Критический симптом: ${symptom}. Опросы пропущены, открыта карта реанимации.`);
    map?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $$('[data-critical-symptom]').forEach((btn) => btn.addEventListener('click', () => triggerEmergency(btn.dataset.criticalSymptom || 'SOS')));

  // Catalog / clinic dynamic veterinary prices by pet weight and species.
  const priceBands = {
    dog: { tag: 'Крупные породы', weight: 11.2, ultrasound: 2600, sedation: 5800, surgery: 12600 },
    cat: { tag: 'Cat-Friendly', weight: 4.6, ultrasound: 2100, sedation: 3900, surgery: 9200 },
  };
  const formatRub = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
  const applyPetContext = (species='dog') => {
    const model = priceBands[species] || priceBands.dog;
    $('#v36rf-context-tag') && ($('#v36rf-context-tag').textContent = model.tag);
    $$('[data-weight-price]').forEach((el) => {
      const key = el.dataset.weightPrice;
      if (model[key]) el.textContent = formatRub(model[key]);
    });
    $$('.v36rf-weight-band').forEach((el) => el.textContent = species === 'cat' ? 'Категория: до 5 кг' : 'Категория: 10–20 кг');
    announce(`Цены пересчитаны для ${model.tag}. Вес: ${model.weight} кг.`);
  };
  $$('[data-v36rf-pet]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-v36rf-pet]').forEach((b) => b.classList.toggle('is-active', b === btn));
    applyPetContext(btn.dataset.v36rfPet);
  }));
  applyPetContext('dog');

  // Alternative soft-hold TTL countdown. UI timer is only visualisation of server expires_at.
  let ttlSeconds = 10 * 60;
  const ttlOutput = $('#v36rf-alt-ttl');
  const ttlState = $('#v36rf-ttl-state');
  const renderTtl = () => {
    if (!ttlOutput) return;
    const m = String(Math.floor(ttlSeconds / 60)).padStart(2, '0');
    const s = String(ttlSeconds % 60).padStart(2, '0');
    ttlOutput.textContent = `${m}:${s}`;
    if (ttlState) ttlState.textContent = ttlSeconds <= 60 ? 'Осталась последняя минута' : 'Таймер запущен';
  };
  renderTtl();
  setInterval(() => { if (ttlSeconds > 0) { ttlSeconds -= 1; renderTtl(); } }, 1000);
  $('#v36rf-freeze-slot')?.addEventListener('click', (event) => {
    ttlSeconds += 10 * 60;
    renderTtl();
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Запрос на заморозку отправлен';
    if (ttlState) ttlState.textContent = 'Продление TTL ожидает backend-подтверждение';
    announce('Запрос на заморозку слота отправлен. Ожидается подтверждение сервера.');
  });

  // Telemed queue KPI — values marked as server authoritative; this only simulates live patching.
  const queueBar = $('.v36rf-kpi-bar');
  if (queueBar) {
    let q = Number(queueBar.dataset.queuePosition || 3);
    let wait = Number(queueBar.dataset.waitMin || 7);
    setInterval(() => {
      q = Math.max(1, q - (Math.random() > 0.65 ? 1 : 0));
      wait = Math.max(2, wait - (Math.random() > 0.5 ? 1 : 0));
      $('#v36rf-queue-position') && ($('#v36rf-queue-position').textContent = String(q));
      $('#v36rf-wait-min') && ($('#v36rf-wait-min').textContent = String(wait));
    }, 15000);
  }
  const checklist = $('.v36rf-wait-checklist');
  const updateChecklist = () => {
    if (!checklist) return;
    const boxes = $$('input[type="checkbox"]', checklist);
    const done = boxes.filter((b) => b.checked).length;
    $('#v36rf-checklist-progress') && ($('#v36rf-checklist-progress').textContent = `${done}/${boxes.length} готово`);
  };
  checklist?.addEventListener('change', updateChecklist);
  updateChecklist();

  // B2B role switching.
  $$('[data-v36rf-role]').forEach((btn) => btn.addEventListener('click', () => {
    const role = btn.dataset.v36rfRole || 'reception';
    document.body.dataset.clinicRole = role;
    $$('[data-v36rf-role]').forEach((b) => b.classList.toggle('is-active', b === btn));
    announce(role === 'doctor' ? 'Включён режим врача. Коммерческие дашборды скрыты.' : 'Включён режим ресепшен. Видны SLA и No-Show риски.');
  }));
})();
