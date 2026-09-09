// VetHelp v48 — interactive clinic administration prototype.
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = 'vethelp-clinic-admin-v48';
  const ADMIN_ROUTES = new Set([
    'clinic-workspace', 'clinic-schedule', 'clinic-appointments',
    'clinic-patients', 'clinic-patient', 'clinic-visit', 'clinic-telemed',
    'clinic-staff', 'clinic-services', 'clinic-profile', 'clinic-quality', 'clinic-settings', 'clinic-notifications'
  ]);
  const assets = {
    dashboard: 'veterinary-hospital.png', schedule: 'schedule-clock.png',
    appointments: 'booking-confirmation.png', patients: 'pet-profile-avatar.png',
    visit: 'medical-history-card.png', telemed: 'telemed-stethoscope.png',
    allergy: 'allergy-alert-marker.png', lab: 'lab-results-ready.png',
    video: 'video-stream-active.png', phone: 'phone-receiver.png'
  };
  const resources = [
    { id:'anna', name:'Анна Смирнова', meta:'Терапевт · Каб. 2' },
    { id:'dmitry', name:'Дмитрий Орлов', meta:'Диагностика · УЗИ' },
    { id:'katya', name:'Катя Сергеева', meta:'Терапевт · Каб. 1' },
    { id:'igor', name:'Игорь Волков', meta:'Хирург · Операционная' }
  ];
  const times = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30'];

  const assetUrl = (path) => new URL(path, document.baseURI).href;
  const defaultPatientFiles = (patientId) => ({
    'P-001':[
      {id:'F-001',kind:'Заключение',name:'Заключение терапевта',date:'18.06.2026',author:'Анна Смирнова',source:'ВетКлиника+',shared:true,preview:'assets/images/doc-conclusion.webp',size:'420 КБ'},
      {id:'F-002',kind:'Диагностика',name:'Рентген грудной клетки',date:'12.05.2026',author:'Дмитрий Орлов',source:'ВетКлиника+',shared:true,preview:'assets/images/doc-xray.webp',size:'1,8 МБ'},
      {id:'F-003',kind:'Ветпаспорт',name:'Ветеринарный паспорт',date:'28.06.2025',author:'Владелец',source:'Владелец',shared:true,preview:'assets/images/doc-passport.webp',size:'680 КБ'},
      {id:'F-004',kind:'Рекомендации',name:'Рекомендации по наблюдению',date:'18.06.2026',author:'Анна Смирнова',source:'ВетКлиника+',shared:false,preview:null,size:'92 КБ'}
    ],
    'P-002':[
      {id:'F-101',kind:'Анализы',name:'Биохимический анализ крови',date:'02.07.2026',author:'Лаборатория',source:'ВетКлиника+',shared:true,preview:null,size:'310 КБ'},
      {id:'F-102',kind:'Диагностика',name:'УЗИ брюшной полости',date:'15.01.2026',author:'Дмитрий Орлов',source:'ВетКлиника+',shared:true,preview:null,size:'540 КБ'}
    ],
    'P-003':[
      {id:'F-201',kind:'Заключение',name:'Осмотр перед вакцинацией',date:'10.07.2026',author:'Катя Сергеева',source:'ВетКлиника+',shared:true,preview:null,size:'180 КБ'}
    ]
  }[patientId] || []);
  const filePreviewUrl = (file) => file?.preview ? (String(file.preview).startsWith('data:') ? file.preview : assetUrl(file.preview)) : '';
  const formatBytes = (bytes) => bytes < 1024 ? `${bytes} Б` : bytes < 1048576 ? `${Math.round(bytes/1024)} КБ` : `${(bytes/1048576).toFixed(1).replace('.',',')} МБ`;

  const initialState = {
    version: 3,
    role: 'reception',
    selectedSlot: 'S-100',
    selectedAppointment: 'A-1001',
    selectedPatient: 'P-001',
    selectedTelemed: 'T-501',
    appointmentFilter: 'all',
    patientQuery: '',
    patients: [
      {
        id:'P-001', name:'Барни', species:'Собака', breed:'Вельш-корги', sex:'Кобель', birth:'14.03.2023', age:'3 года', weight:'11,2 кг',
        avatar:assetUrl('assets/images/pet-barney.webp'), owner:'Екатерина Романова', phone:'+7 000 000-00-00', email:'demo@example.invalid',
        allergies:['Амоксициллин','Лидокаин — требуется уточнение'], conditions:['Кашель после нагрузки','Контроль веса'], policy:'Pet Protect · до 12.05.2027',
        lastVisit:'18.06.2026', documents:4, balance:'0 ₽',
        records:[
          { date:'18.06.2026', title:'Консультация терапевта', copy:'Кашель после прогулки. Назначено наблюдение и рентген при сохранении симптомов.', doctor:'Анна Смирнова' },
          { date:'12.05.2026', title:'Рентген грудной клетки', copy:'Документ загружен клиникой, заключение доступно в карточке.', doctor:'Дмитрий Орлов' },
          { date:'28.06.2025', title:'Комплексная вакцинация', copy:'Следующая ревакцинация рекомендована через 12 месяцев.', doctor:'Катя Сергеева' }
        ]
      },
      {
        id:'P-002', name:'Мурка', species:'Кошка', breed:'Домашняя короткошёрстная', sex:'Кошка', birth:'08.09.2020', age:'5 лет', weight:'4,6 кг',
        avatar:assetUrl('assets/images/pet-murka.webp'), owner:'Игорь Петров', phone:'+7 000 000-00-00', email:'demo@example.invalid',
        allergies:[], conditions:['Наблюдение функции почек'], policy:'Полиса нет', lastVisit:'02.07.2026', documents:7, balance:'2 400 ₽',
        records:[
          { date:'02.07.2026', title:'Биохимический анализ крови', copy:'Результат получен из лаборатории, требуется контрольный разбор врачом.', doctor:'Дмитрий Орлов' },
          { date:'15.01.2026', title:'УЗИ брюшной полости', copy:'Плановое наблюдение. Следующий контроль через 6 месяцев.', doctor:'Дмитрий Орлов' }
        ]
      },
      {
        id:'P-003', name:'Лаки', species:'Собака', breed:'Померанский шпиц', sex:'Кобель', birth:'22.11.2024', age:'1 год 7 месяцев', weight:'3,8 кг',
        avatar:assetUrl('assets/images/pet-lucky.webp'), owner:'Мария Соколова', phone:'+7 000 000-00-00', email:'demo@example.invalid',
        allergies:[], conditions:['Плановая вакцинация'], policy:'СберСтрахование · до 03.02.2027', lastVisit:'10.07.2026', documents:3, balance:'0 ₽',
        records:[{ date:'10.07.2026', title:'Осмотр перед вакцинацией', copy:'Противопоказаний по данным осмотра не выявлено.', doctor:'Катя Сергеева' }]
      },
      {
        id:'P-004', name:'Кеша', species:'Птица', breed:'Волнистый попугай', sex:'Самец', birth:'01.05.2022', age:'4 года', weight:'36 г',
        avatar:assetUrl('assets/icons/pet-profile-avatar.png'), owner:'Ольга Власова', phone:'+7 000 000-00-00', email:'demo@example.invalid',
        allergies:[], conditions:['Нужен врач по птицам'], policy:'Полиса нет', lastVisit:'—', documents:1, balance:'0 ₽', records:[]
      },
      {
        id:'P-005', name:'Тоша', species:'Кролик', breed:'Карликовый баран', sex:'Самец', birth:'09.01.2021', age:'5 лет', weight:'2,1 кг',
        avatar:assetUrl('assets/icons/pet-profile-avatar.png'), owner:'Алексей Миронов', phone:'+7 000 000-00-00', email:'demo@example.invalid',
        allergies:['Неизвестно'], conditions:['Снижение аппетита'], policy:'Полиса нет', lastVisit:'09.07.2026', documents:2, balance:'1 500 ₽',
        records:[{ date:'09.07.2026', title:'Онлайн-маршрутизация', copy:'Рекомендован очный осмотр специалистом по экзотическим животным.', doctor:'Анна Смирнова' }]
      }
    ],
    appointments: [
      { id:'A-1001', time:'10:00', patientId:'P-001', service:'Первичный приём терапевта', doctorId:'anna', room:'Каб. 2', status:'new', source:'VetHelp', channel:'clinic', price:'1 200 ₽', risk:'Аллергия', created:'09:42', note:'Кашель после прогулки, снижение активности' },
      { id:'A-1002', time:'10:30', patientId:'P-002', service:'УЗИ брюшной полости', doctorId:'dmitry', room:'Диагностика', status:'confirmed', source:'Сайт клиники', channel:'clinic', price:'2 400 ₽', risk:'Контроль анализов', created:'08:35', note:'Плановое наблюдение после анализов' },
      { id:'A-1003', time:'11:00', patientId:'P-003', service:'Комплексная вакцинация', doctorId:'katya', room:'Каб. 1', status:'checkedin', source:'Телефон', channel:'clinic', price:'2 100 ₽', risk:'Нет', created:'Вчера', note:'Плановая вакцинация' },
      { id:'A-1004', time:'11:30', patientId:'P-004', service:'Консультация по птицам', doctorId:'anna', room:'Каб. 2', status:'needs-info', source:'VetHelp', channel:'clinic', price:'от 1 600 ₽', risk:'Не подтверждена компетенция', created:'09:58', note:'Снижение активности и аппетита' },
      { id:'A-1005', time:'12:00', patientId:'P-005', service:'Онлайн-консультация', doctorId:'anna', room:'Онлайн', status:'telemed-wait', source:'Страховой партнёр', channel:'telemed', price:'Включено', risk:'Снижение аппетита', created:'10:02', note:'Нужна оценка срочности и маршрута' },
      { id:'A-0998', time:'09:00', patientId:'P-001', service:'Контрольный осмотр', doctorId:'anna', room:'Каб. 2', status:'done', source:'Повторная запись', channel:'clinic', price:'900 ₽', risk:'Нет', created:'08.07', note:'Контроль состояния' }
    ],
    slots: [
      { id:'S-100', time:'10:00', resourceId:'anna', duration:30, type:'clinic', status:'booked', appointmentId:'A-1001' },
      { id:'S-101', time:'10:30', resourceId:'dmitry', duration:40, type:'clinic', status:'booked', appointmentId:'A-1002' },
      { id:'S-102', time:'11:00', resourceId:'katya', duration:30, type:'clinic', status:'booked', appointmentId:'A-1003' },
      { id:'S-103', time:'11:30', resourceId:'anna', duration:30, type:'clinic', status:'hold', appointmentId:'A-1004' },
      { id:'S-104', time:'12:00', resourceId:'anna', duration:30, type:'telemed', status:'telemed', appointmentId:'A-1005' },
      { id:'S-105', time:'12:30', resourceId:'igor', duration:60, type:'clinic', status:'blocked', label:'Подготовка операционной' },
      { id:'S-106', time:'13:00', resourceId:'dmitry', duration:30, type:'clinic', status:'blocked', label:'Перерыв' }
    ],
    telemed: [
      { id:'T-501', patientId:'P-005', doctorId:'anna', status:'waiting', wait:'04:12', topic:'Снижение аппетита', redFlags:'Не отмечены', quality:'Хорошая', source:'Страховой партнёр', documents:2 },
      { id:'T-502', patientId:'P-001', doctorId:'anna', status:'scheduled', wait:'12:30', topic:'Разбор рентгена', redFlags:'Не отмечены', quality:'Хорошая', source:'Повторный приём', documents:4 },
      { id:'T-503', patientId:'P-002', doctorId:'dmitry', status:'needs-route', wait:'02:08', topic:'Рвота и вялость', redFlags:'Повторная рвота', quality:'Средняя', source:'VetHelp', documents:3 },
      { id:'T-504', patientId:'P-003', doctorId:'katya', status:'in-call', wait:'08:41', topic:'После вакцинации', redFlags:'Не отмечены', quality:'Хорошая', source:'Сайт клиники', documents:1 }
    ],
    drafts: {
      'P-001': { complaint:'Кашель после прогулки. Аппетит сохранён, активность снижена.', anamnesis:'Симптом отмечен три дня назад. Травм и контакта с раздражителями владелец не отмечает.', exam:'', assessment:'', plan:'', temperature:'38,6', pulse:'96', respiration:'24' }
    },
    treatments: [
      { id:'TR-1', patientId:'P-001', name:'Рентген грудной клетки', qty:'1', price:'1 900 ₽', consent:'Ожидается' }
    ],
    audit: [
      { time:'10:23', title:'Открыта карточка Барни', actor:'Анна Смирнова · врач' },
      { time:'10:17', title:'Начат осмотр Лаки', actor:'Катя Сергеева · врач' },
      { time:'10:03', title:'Подтверждено УЗИ Мурки', actor:'Светлана · ресепшен' },
      { time:'09:58', title:'Получена заявка на приём птицы', actor:'VetHelp · интеграция' }
    ]
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const icon = (name) => `<img src="${assetUrl(`assets/icons/${assets[name]}`)}" alt="" aria-hidden="true" draggable="false"/>`;
  const patientById = (id) => state.patients.find((patient) => patient.id === id);
  const appointmentById = (id) => state.appointments.find((appointment) => appointment.id === id);
  const resourceById = (id) => resources.find((resource) => resource.id === id);
  const telemedById = (id) => state.telemed.find((item) => item.id === id);
  const nowTime = () => new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.version === initialState.version) return stored;
    } catch (_) { /* Demo falls back to fixtures. */ }
    return clone(initialState);
  }
  let state = loadState();
  state.patients = (state.patients || []).map((patient) => { const files = Array.isArray(patient.files) ? patient.files : defaultPatientFiles(patient.id); return { ...patient, avatar: assetUrl(patient.avatar || 'assets/images/pet-lucky.webp'), files, documents: Math.max(Number(patient.documents || 0), files.length) }; });

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Storage may be disabled. */ }
  }
  function addAudit(title, actor = 'Текущий сотрудник') {
    state.audit.unshift({ time:nowTime(), title, actor });
    state.audit = state.audit.slice(0, 20);
  }
  function statusMeta(status) {
    return ({
      new:['Новая заявка','orange'], confirmed:['Подтверждена','green'], checkedin:['В клинике','purple'],
      'in-visit':['На приёме','purple'], done:['Завершена','gray'], cancelled:['Отменена','red'],
      'needs-info':['Нужно уточнение','orange'], 'telemed-wait':['Онлайн-очередь','purple'],
      waiting:['Ожидает врача','orange'], scheduled:['Запланирована','blue'], 'needs-route':['Нужен очный маршрут','red'],
      'in-call':['Идёт консультация','purple'], completed:['Завершена','gray']
    }[status] || [status,'gray']);
  }
  function statusBadge(status) {
    const [label, cls] = statusMeta(status);
    return `<span class="v48-status ${cls}">${esc(label)}</span>`;
  }
  function currentRoute() { return (location.hash || '#home').slice(1); }

  function roleSwitch() {
    return `<div class="v48-role-switch" role="group" aria-label="Роль сотрудника">
      <button type="button" data-admin-role="reception" class="${state.role === 'reception' ? 'is-active' : ''}" aria-pressed="${state.role === 'reception'}">Ресепшен</button>
      <button type="button" data-admin-role="doctor" class="${state.role === 'doctor' ? 'is-active' : ''}" aria-pressed="${state.role === 'doctor'}">Врач</button>
      <button type="button" data-admin-role="admin" class="${state.role === 'admin' ? 'is-active' : ''}" aria-pressed="${state.role === 'admin'}">Админ</button>
    </div>`;
  }
  function staffChip() {
    const doctor = state.role === 'doctor';
    const admin = state.role === 'admin';
    const image = doctor ? 'doctor-anna.webp' : 'client-ekaterina.webp';
    const name = doctor ? 'Анна Смирнова' : 'Светлана Котова';
    const meta = doctor ? 'Врач-терапевт · Каб. 2' : admin ? 'Администратор клиники · управление' : 'Администратор · смена до 21:00';
    return `<div class="v48-staff-chip" aria-label="Текущий сотрудник">
      <img src="${assetUrl(`assets/images/${image}`)}" alt="${name}"/>
      <span><strong>${name}</strong><small>${meta}</small></span>
    </div>`;
  }
  function adminHeader(title, subtitle, action = '') {
    return `<header class="topbar v48-admin-topbar">
      <div><div class="v48-admin-title-line"><h1>${esc(title)}</h1><span class="pill blue">ВетКлиника+ · Центр</span></div><p class="subtitle">${esc(subtitle)}</p></div>
      <div class="v48-admin-top-actions">${action}${roleSwitch()}<button class="icon-btn notification" type="button" aria-label="Уведомления клиники"><svg aria-hidden="true" class="vh-icon"><use href="#i-bell"></use></svg></button>${staffChip()}</div>
    </header>`;
  }
  function adminTabs() {
    const byRole = {
      reception: [
        ['clinic-workspace','Сегодня'],
        ['clinic-appointments','Записи'],
        ['clinic-schedule','Расписание'],
        ['clinic-patients','Пациенты']
      ],
      doctor: [
        ['clinic-workspace','Сегодня'],
        ['clinic-visit','Приём'],
        ['clinic-patients','Пациенты'],
        ['clinic-telemed','Онлайн']
      ],
      admin: [
        ['clinic-workspace','Сегодня'],
        ['clinic-profile','Клиника'],
        ['clinic-staff','Команда'],
        ['clinic-settings','Настройки']
      ]
    };
    const route = currentRoute();
    const tabs = byRole[state.role] || byRole.reception;
    return `<nav class="v48-admin-tabs clinic-simple-tabs" aria-label="Основные разделы">${tabs.map(([id,label]) =>
      `<a href="#${id}" class="${route === id || (route === 'clinic-patient' && id === 'clinic-patients') ? 'active' : ''}"><span>${label}</span></a>`
    ).join('')}</nav>`;
  }
  function prototypeNotice() { return ''; }
  function shell(title, subtitle, content, action = '') {
    return `<div class="v48-admin-page clinic-simple-page">${adminHeader(title, subtitle, action)}${adminTabs()}${content}</div>`;
  }

  function roleValuePanel() {
    if (state.role === 'admin') return `<section class="bh-clinic-value"><div><span class="kicker">Готовность к онлайн-записи</span><strong>Основной контур настроен</strong><small>Проверьте публичные данные — после этого владельцы увидят актуальную карточку клиники.</small></div><div class="bh-clinic-value__aside"><div class="bh-clinic-progress"><span style="width:82%"></span></div><a href="#clinic-profile">Проверить карточку →</a></div></section>`;
    if (state.role === 'doctor') return `<section class="bh-clinic-value"><div><span class="kicker">Меньше ручной передачи</span><strong>Закройте результат один раз</strong><small>Заключение останется в истории, документ можно сразу отправить владельцу.</small></div><a href="#clinic-visit">Открыть приём →</a></section>`;
    return `<section class="bh-clinic-value"><div><span class="kicker">Что даст следующий шаг</span><strong>Подтвердите новые заявки</strong><small>Статус обновится у владельца автоматически — отдельный звонок не нужен.</small></div><a href="#clinic-appointments">Разобрать заявки →</a></section>`;
  }
  function scheduleValuePanel() {
    return `<section class="bh-clinic-value bh-clinic-value--soft"><div><span class="kicker">Сразу видно результат</span><strong>Открытое окно сразу доступно владельцу</strong><small>Закрыли слот — он сразу исчез из новых вариантов записи.</small></div><span class="v48-status green">7 свободных окон</span></section>`;
  }
  function appointmentImpact(item) {
    if (item.status === 'new') return `<div class="bh-clinic-impact"><strong>После подтверждения</strong><span>владелец увидит актуальный статус в VetHelp — отдельный звонок для подтверждения не нужен.</span></div>`;
    if (item.status === 'needs-info') return `<div class="bh-clinic-impact"><strong>Сначала уточнение</strong><span>зафиксируйте недостающую информацию один раз, чтобы следующий сотрудник не спрашивал её повторно.</span></div>`;
    return `<div class="bh-clinic-impact"><strong>Контекст сохранён</strong><span>запись, питомец и выбранная услуга уже связаны — переходите к следующему действию без повторного поиска.</span></div>`;
  }

  function dashboardPage() {
    const pending = state.appointments.filter((item) => ['new','needs-info'].includes(item.status)).length;
    const inClinic = state.appointments.filter((item) => ['checkedin','in-visit'].includes(item.status)).length;
    const tasks = state.appointments.filter((item) => ['new','needs-info','checkedin'].includes(item.status)).slice(0,4);
    const doctorTasks = state.appointments.filter((item) => ['checkedin','in-visit'].includes(item.status)).slice(0,4);
    const adminTasks = [
      ['Профиль клиники','Проверьте часы работы и публичные данные','#clinic-profile'],
      ['Команда','5 сотрудников сегодня на смене','#clinic-staff'],
      ['Настройки','Каналы записи и рабочая локация','#clinic-settings']
    ];
    if (state.role === 'admin') {
      return shell('Сегодня','Короткая сводка и только то, что требует решения.',
        `<div class="clinic-home-overview"><section class="clinic-simple-summary"><span><strong>6</strong> записей сегодня</span><span><strong>91%</strong> визитов вовремя</span><span><strong>3</strong> свободных окна</span></section>${roleValuePanel()}</div>
         <section class="v48-panel clinic-simple-focus"><div class="v48-panel-head"><div><h2>Управление клиникой</h2><p>Остальные настройки спрятаны внутри нужного раздела.</p></div></div>
           <div class="clinic-simple-actions">${adminTasks.map(([title,copy,href])=>`<a class="clinic-simple-action" href="${href}"><strong>${title}</strong><small>${copy}</small><span>→</span></a>`).join('')}</div>
         </section>`);
    }
    const visibleTasks = state.role === 'doctor' ? doctorTasks : tasks;
    const heading = state.role === 'doctor' ? 'Следующие пациенты' : 'Что требует действия';
    const link = state.role === 'doctor' ? '#clinic-visit' : '#clinic-appointments';
    const summary = state.role === 'doctor'
      ? `<span><strong>${inClinic}</strong> пациента в клинике</span><span><strong>${state.telemed.filter((i)=>['waiting','needs-route'].includes(i.status)).length}</strong> онлайн</span><span><strong>1</strong> требует внимания</span>`
      : `<span><strong>${pending}</strong> ждут подтверждения</span><span><strong>${inClinic}</strong> в клинике</span><span><strong>7</strong> свободных окон</span>`;
    return shell('Сегодня', state.role === 'doctor' ? 'Пациенты и консультации на текущую смену.' : 'Записи и задачи текущей смены.',
      `<div class="clinic-home-overview"><section class="clinic-simple-summary">${summary}</section>${roleValuePanel()}</div>
       <section class="v48-panel clinic-simple-focus"><div class="v48-panel-head"><div><h2>${heading}</h2><p>${state.role === 'doctor' ? 'Открывайте пациента только когда нужно продолжить приём.' : 'Сначала новые заявки и пациенты, которые уже пришли.'}</p></div><a class="section-link" href="${link}">Открыть раздел →</a></div>
         <div class="v48-task-list">${visibleTasks.map((item) => {
           const patient = patientById(item.patientId); const resource = resourceById(item.doctorId);
           const next = state.role === 'doctor' ? 'Открыть' : item.status === 'new' ? 'Подтвердить' : item.status === 'needs-info' ? 'Уточнить' : 'Открыть';
           return `<article class="v48-task"><span class="v48-task__time">${item.time}</span><span><strong>${esc(patient.name)} · ${esc(item.service)}</strong><small>${esc(resource.name)} · ${statusBadge(item.status)}</small></span><button class="v48-mini-button ${item.status === 'new' ? 'primary' : ''}" type="button" data-open-appointment="${item.id}">${next}</button></article>`;
         }).join('') || '<div class="v48-empty">На ближайшее время действий нет.</div>'}</div>
       </section>`);
  }

  function slotCell(time, resource) {
    const slot = state.slots.find((item) => item.time === time && item.resourceId === resource.id);
    if (!slot) return `<button class="v48-slot" type="button" data-empty-slot data-time="${time}" data-resource="${resource.id}"><strong>Свободно</strong><small>Создать окно</small></button>`;
    const appointment = appointmentById(slot.appointmentId);
    const patient = appointment ? patientById(appointment.patientId) : null;
    const label = patient ? `${patient.name} · ${appointment.service}` : slot.label || 'Закрыто';
    const meta = appointment ? `${slot.duration} мин · ${statusMeta(appointment.status)[0]}` : `${slot.duration} мин`;
    const cls = slot.status === 'booked' ? 'is-booked' : slot.status === 'hold' ? 'is-hold' : slot.status === 'blocked' ? 'is-blocked' : slot.status === 'telemed' ? 'is-telemed' : '';
    return `<button class="v48-slot ${cls}" type="button" data-slot-id="${slot.id}" aria-pressed="${state.selectedSlot === slot.id}"><strong>${esc(label)}</strong><small>${esc(meta)}</small></button>`;
  }
  function selectedSlotPanel() {
    const slot = state.slots.find((item) => item.id === state.selectedSlot);
    if (!slot) return `<div class="v48-empty"><span>Выберите окно в расписании, чтобы увидеть детали и действия.</span></div>`;
    const resource = resourceById(slot.resourceId);
    const appointment = appointmentById(slot.appointmentId);
    const patient = appointment ? patientById(appointment.patientId) : null;
    return `<div class="v48-slot-editor"><div class="v48-fact-grid">
      <div class="v48-fact"><span>Время</span><strong>${slot.time} · ${slot.duration} минут</strong></div>
      <div class="v48-fact"><span>Ресурс</span><strong>${esc(resource.name)} · ${esc(resource.meta)}</strong></div>
      <div class="v48-fact"><span>Тип</span><strong>${slot.type === 'telemed' ? 'Онлайн' : 'В клинике'}</strong></div>
      <div class="v48-fact"><span>Статус</span><strong>${esc(slot.status === 'booked' ? 'Занято' : slot.status === 'hold' ? 'Предварительно удержано' : slot.status === 'blocked' ? 'Заблокировано' : 'Онлайн')}</strong></div>
    </div>
    ${patient ? `<div class="v48-person"><img src="${patient.avatar}" alt=""/><span><strong>${esc(patient.name)} · ${esc(appointment.service)}</strong><small>${esc(patient.owner)} · ${esc(patient.phone)}</small></span></div>` : `<p class="muted small">${esc(slot.label || 'Служебное окно')}</p>`}
    <div class="v48-panel-actions">${appointment ? `<button class="v48-mini-button primary" type="button" data-open-appointment="${appointment.id}">Открыть запись</button>` : ''}<button class="v48-mini-button" type="button" data-slot-toggle="${slot.id}">${slot.status === 'blocked' ? 'Открыть слот' : 'Заблокировать'}</button></div></div>`;
  }
  function schedulePage() {
    const grid = `<div class="v48-schedule-grid"><div class="v48-schedule-head">Время</div>${resources.map((resource) => `<div class="v48-schedule-head"><strong>${esc(resource.name.split(' ')[0])}</strong><br/>${esc(resource.meta)}</div>`).join('')}${times.map((time) => `<div class="v48-schedule-time">${time}</div>${resources.map((resource) => `<div>${slotCell(time, resource)}</div>`).join('')}`).join('')}</div>`;
    return shell('Слоты и ресурсы','Управление окнами врачей, кабинетами, оборудованием и онлайн-приёмом.',
      `<div class="v48-toolbar"><div class="v48-toolbar__group"><button class="v48-filter-button" type="button">←</button><button class="v48-filter-button is-active" type="button">Сегодня, 10 июля</button><button class="v48-filter-button" type="button">Завтра</button><button class="v48-filter-button" type="button">Неделя</button></div><div class="v48-toolbar__group"><button class="btn secondary" type="button" data-open-slot-modal>Создать слот</button><button class="btn" type="button" data-open-appointment-modal>Новая запись</button></div></div>
      ${scheduleValuePanel()}<div class="v48-schedule-layout">
        <aside class="v48-grid v48-schedule-sidebar"><section class="v48-panel"><div class="v48-panel-head"><div><h2>Выбранное окно</h2><p>Изменения должны проверять врача, кабинет и оборудование.</p></div></div>${selectedSlotPanel()}</section><section class="v48-panel"><h3>Легенда</h3><div class="v48-activity-list" style="margin-top:10px"><div class="v48-activity"><time>Синий</time><span><strong>Подтверждённая запись</strong></span></div><div class="v48-activity"><time>Жёлтый</time><span><strong>Удержание или уточнение</strong></span></div><div class="v48-activity"><time>Серый</time><span><strong>Перерыв или служебная блокировка</strong></span></div><div class="v48-activity"><time>Фиолетовый</time><span><strong>Телемедицина</strong></span></div></div></section></aside>
        <section class="v48-panel"><div class="v48-panel-head"><div><h2>Расписание смены</h2><p>Свободные окна создаются отдельно; занятые связаны с записью пациента.</p></div><div class="v48-panel-actions"><span class="v48-status green">7 свободных</span><span class="v48-status orange">1 конфликт</span></div></div><div class="v48-schedule-scroll">${grid}</div></section>
      </div>`
    );
  }

  function filteredAppointments() {
    if (state.appointmentFilter === 'all') return state.appointments;
    if (state.appointmentFilter === 'attention') return state.appointments.filter((item) => ['new','needs-info'].includes(item.status));
    if (state.appointmentFilter === 'active') return state.appointments.filter((item) => ['confirmed','checkedin','in-visit','telemed-wait'].includes(item.status));
    return state.appointments.filter((item) => item.status === state.appointmentFilter);
  }
  function appointmentDetail() {
    const item = appointmentById(state.selectedAppointment) || state.appointments[0];
    const patient = patientById(item.patientId); const resource = resourceById(item.doctorId);
    const actions = item.status === 'new'
      ? `<button class="btn" type="button" data-appointment-action="confirm" data-id="${item.id}">Подтвердить</button><button class="btn secondary" type="button" data-appointment-action="reschedule" data-id="${item.id}">Предложить другое время</button>`
      : item.status === 'confirmed'
        ? `<button class="btn" type="button" data-appointment-action="checkin" data-id="${item.id}">Пациент прибыл</button><button class="btn secondary" type="button" data-appointment-action="reschedule" data-id="${item.id}">Перенести</button>`
        : ['checkedin','in-visit'].includes(item.status)
          ? `<button class="btn" type="button" data-appointment-action="visit" data-id="${item.id}">Открыть приём</button>`
          : `<button class="btn secondary" type="button" data-open-patient="${patient.id}">Карточка пациента</button>`;
    return `<div class="v48-patient-hero"><img src="${patient.avatar}" alt="${esc(patient.name)}"/><div><span class="kicker">Запись ${item.id}</span><h2>${esc(patient.name)}</h2><p class="muted small">${esc(patient.breed)} · ${esc(patient.owner)}</p></div></div>
      <div class="v48-fact-grid" style="margin-top:14px"><div class="v48-fact"><span>Время</span><strong>Сегодня · ${item.time}</strong></div><div class="v48-fact"><span>Статус</span><strong>${statusBadge(item.status)}</strong></div><div class="v48-fact"><span>Услуга</span><strong>${esc(item.service)}</strong></div><div class="v48-fact"><span>Врач</span><strong>${esc(resource.name)} · ${esc(item.room)}</strong></div><div class="v48-fact"><span>Стоимость</span><strong>${esc(item.price)}</strong></div><div class="v48-fact"><span>Источник</span><strong>${esc(item.source)}</strong></div></div>
      ${patient.allergies.length ? `<div class="v48-alert" style="margin-top:12px">${icon('allergy')}<span><strong>Аллергии и ограничения</strong><small>${esc(patient.allergies.join(' · '))}</small></span></div>` : ''}
      <div class="v48-consent-card" style="margin-top:10px"><strong>Причина обращения</strong><small>${esc(item.note)}</small></div>
      ${appointmentImpact(item)}
      <div class="v48-panel-actions" style="margin-top:13px">${actions}<button class="v48-mini-button danger" type="button" data-appointment-action="cancel" data-id="${item.id}">Отменить</button></div>`;
  }
  function appointmentsPage() {
    const rows = filteredAppointments().map((item) => { const patient = patientById(item.patientId); const resource = resourceById(item.doctorId); return `<tr data-appointment-row="${item.id}" class="${state.selectedAppointment === item.id ? 'is-selected' : ''}" tabindex="0"><td><strong>${item.time}</strong><small class="staff-sub">${esc(item.created)}</small></td><td><div class="v48-person"><img src="${patient.avatar}" alt=""/><span><strong>${esc(patient.name)}</strong><small>${esc(patient.owner)}</small></span></div></td><td><strong>${esc(item.service)}</strong><small class="staff-sub">${esc(resource.name)} · ${esc(item.room)}</small></td><td>${statusBadge(item.status)}</td><td><strong>${esc(item.price)}</strong><small class="staff-sub">${esc(item.source)}</small></td><td><span class="v48-status ${item.risk === 'Нет' ? 'gray' : item.risk.includes('Аллерг') ? 'red' : 'orange'}">${esc(item.risk)}</span></td></tr>`; }).join('');
    return shell('Записи и очередь','Подтверждение заявок, check-in, переносы и переход к медицинскому приёму.',
      `<div class="v48-toolbar"><div class="v48-toolbar__group"><input class="v48-search" type="search" id="v48-appointment-search" placeholder="Питомец, владелец, услуга" aria-label="Поиск записей"/><button class="v48-filter-button ${state.appointmentFilter === 'all' ? 'is-active' : ''}" type="button" data-appointment-filter="all">Все</button><button class="v48-filter-button ${state.appointmentFilter === 'attention' ? 'is-active' : ''}" type="button" data-appointment-filter="attention">Требуют внимания</button><button class="v48-filter-button ${state.appointmentFilter === 'active' ? 'is-active' : ''}" type="button" data-appointment-filter="active">В работе</button></div><button class="btn" type="button" data-open-appointment-modal>Добавить запись</button></div>
      <div class="v48-grid v48-grid--split"><section class="v48-panel"><div class="v48-panel-head"><div><h2>Сегодня · ${filteredAppointments().length} записей</h2><p>Статус записи не смешивается со статусом визита и оплаты.</p></div></div><div class="v48-table-wrap"><table class="v48-table"><thead><tr><th>Время</th><th>Пациент</th><th>Услуга и врач</th><th>Статус</th><th>Цена и источник</th><th>Риск</th></tr></thead><tbody>${rows}</tbody></table></div></section><aside class="v48-panel">${appointmentDetail()}</aside></div>`
    );
  }

  function patientSummary(patient, mode = 'preview') {
    const previewActions = mode === 'preview'
      ? `<div class="v48-panel-actions" style="margin-top:13px"><button class="btn" type="button" data-open-patient="${patient.id}">Открыть карточку</button><button class="btn secondary" type="button" data-start-visit="${patient.id}">Новый приём</button></div>`
      : mode === 'full'
        ? `<div class="v48-panel-actions" style="margin-top:13px"><button class="btn" type="button" data-start-visit="${patient.id}">Начать приём</button><button class="btn secondary" type="button" data-upload-result="${patient.id}">Загрузить результат</button></div>`
        : '';
    return `<div class="v48-patient-hero"><img src="${patient.avatar}" alt="${esc(patient.name)}"/><div><span class="kicker">${patient.id}</span><h2>${esc(patient.name)}</h2><p class="muted small">${esc(patient.species)} · ${esc(patient.breed)} · ${esc(patient.age)}</p></div></div>
      ${patient.allergies.length ? `<div class="v48-alert" style="margin-top:12px">${icon('allergy')}<span><strong>Аллергии</strong><small>${esc(patient.allergies.join(' · '))}</small></span></div>` : ''}
      <div class="v48-fact-grid" style="margin-top:12px"><div class="v48-fact"><span>Владелец</span><strong>${esc(patient.owner)}</strong></div><div class="v48-fact"><span>Телефон</span><strong>${esc(patient.phone)}</strong></div><div class="v48-fact"><span>Вес</span><strong>${esc(patient.weight)}</strong></div><div class="v48-fact"><span>Последний визит</span><strong>${esc(patient.lastVisit)}</strong></div><div class="v48-fact"><span>Полис</span><strong>${esc(patient.policy)}</strong></div><div class="v48-fact"><span>Документы</span><strong>${patient.files?.length || patient.documents || 0}</strong></div></div>${previewActions}`;
  }

  function patientFilesSection(patient) {
    const files = Array.isArray(patient.files) ? patient.files : [];
    return `<section class="v48-panel clinic-patient-documents"><div class="v48-panel-head"><div><h2>Документы и результаты</h2><p>Загрузите результат один раз: он останется в истории пациента, а отправку владельцу можно сделать отдельным действием.</p></div><button class="btn" type="button" data-upload-result="${patient.id}">Загрузить результат</button></div><div class="bh-clinic-impact"><strong>Зачем это врачу и ресепшену</strong><span>не нужно искать файл после визита и пересылать его вручную из другой системы.</span></div>
      <div class="clinic-document-list">${files.length ? files.map((file) => `<article class="clinic-document-row"><button class="clinic-document-preview" type="button" data-open-file="${file.id}" data-patient-id="${patient.id}" aria-label="Открыть ${esc(file.name)}">${filePreviewUrl(file) ? `<img src="${filePreviewUrl(file)}" alt=""/>` : `<span>${icon(file.kind === 'Анализы' ? 'lab' : 'visit')}</span>`}</button><div class="clinic-document-copy"><div class="clinic-document-title"><strong>${esc(file.name)}</strong><span class="v48-status ${file.shared ? 'green' : 'orange'}">${file.shared ? 'Отправлено владельцу' : 'Только клиника'}</span></div><small>${esc(file.kind)} · ${esc(file.date)} · ${esc(file.author)} · ${esc(file.size || '')}</small><small>Источник: ${esc(file.source || 'ВетКлиника+')}</small></div><div class="clinic-document-actions"><button class="v48-mini-button" type="button" data-open-file="${file.id}" data-patient-id="${patient.id}">Просмотреть</button>${file.shared ? '' : `<button class="v48-mini-button primary" type="button" data-send-file="${file.id}" data-patient-id="${patient.id}">Отправить владельцу</button>`}</div></article>`).join('') : '<div class="v48-empty">Документов пока нет</div>'}</div></section>`;
  }

  function patientsPage() {
    const query = state.patientQuery.trim().toLowerCase();
    const list = state.patients.filter((patient) => !query || [patient.name,patient.owner,patient.phone,patient.breed].join(' ').toLowerCase().includes(query));
    const selected = patientById(state.selectedPatient) || list[0] || state.patients[0];
    return shell('Пациенты','Единый реестр животных, владельцев, медицинских ограничений и истории обращений.',
      `<div class="v48-toolbar"><div class="v48-toolbar__group"><input class="v48-search" type="search" data-patient-search value="${esc(state.patientQuery)}" placeholder="Питомец, владелец или телефон" aria-label="Поиск пациентов"/><button class="v48-filter-button is-active" type="button">Все виды</button><button class="v48-filter-button" type="button">С аллергиями</button><button class="v48-filter-button" type="button">Есть долг</button></div><button class="btn" type="button" data-open-patient-modal>Добавить пациента</button></div>
      <div class="v48-patient-layout"><section class="v48-panel"><div class="v48-panel-head"><div><h2>Реестр · ${list.length}</h2><p>Медицинская карточка хранится отдельно для каждого питомца владельца.</p></div></div><div class="v48-patient-list">${list.map((patient) => `<button class="v48-patient-row ${state.selectedPatient === patient.id ? 'is-selected' : ''}" type="button" data-select-patient="${patient.id}"><img src="${patient.avatar}" alt=""/><span><strong>${esc(patient.name)} · ${esc(patient.breed)}</strong><small>${esc(patient.owner)} · ${esc(patient.phone)}</small></span><span class="v48-status ${patient.allergies.length ? 'red' : 'gray'}">${patient.allergies.length ? 'Аллергия' : patient.documents + ' док.'}</span></button>`).join('') || '<div class="v48-empty">Ничего не найдено</div>'}</div></section><aside class="v48-panel">${patientSummary(selected)}</aside></div>`
    );
  }
  function patientPage() {
    const patient = patientById(state.selectedPatient) || state.patients[0];
    return shell(`Карточка пациента: ${patient.name}`,'Полная карточка питомца: медицинские ограничения, история, документы и связь с владельцем.',
      `<div class="clinic-patient-detail-toolbar"><button class="v48-mini-button" type="button" data-back-patients>← К реестру</button><span class="v48-status green">Карточка открыта</span></div>
      <div class="clinic-patient-detail-grid"><section class="v48-panel clinic-patient-identity">${patientSummary(patient,'full')}</section>
      <aside class="v48-panel clinic-patient-current"><div class="v48-panel-head"><div><h2>Текущие сведения</h2><p>Критичные данные требуют подтверждения источником.</p></div></div><div class="v48-activity-list"><div class="v48-activity"><time>Состояния</time><span><strong>${esc(patient.conditions.join(' · ') || 'Не указаны')}</strong></span></div><div class="v48-activity"><time>Контакт</time><span><strong>${esc(patient.owner)}</strong><small>${esc(patient.phone)} · ${esc(patient.email)}</small></span></div><div class="v48-activity"><time>Страхование</time><span><strong>${esc(patient.policy)}</strong></span></div></div><div class="clinic-patient-quick-actions"><button class="btn" type="button" data-start-visit="${patient.id}">Начать приём</button><button class="btn secondary" type="button" data-start-telemed="${patient.id}">Онлайн-консультация</button><a class="btn secondary" href="tel:${patient.phone.replace(/[^+\d]/g,'')}">Позвонить владельцу</a></div></aside></div>
      ${patientFilesSection(patient)}
      <section class="v48-panel" style="margin-top:14px"><div class="v48-panel-head"><div><h2>История лечения</h2><p>Источник, врач и дата сохраняются для каждой записи.</p></div><button class="v48-mini-button" type="button" data-start-visit="${patient.id}">Новый приём</button></div><div class="v48-record-list">${patient.records.length ? patient.records.map((record) => `<article class="v48-record"><time>${esc(record.date)}</time><span><strong>${esc(record.title)}</strong><small>${esc(record.copy)}</small></span><span class="v48-status gray">${esc(record.doctor)}</span></article>`).join('') : '<div class="v48-empty">История обращений пока пуста</div>'}</div></section>`
    );
  }

  function visitPage() {
    const patient = patientById(state.selectedPatient) || state.patients[0];
    const draft = state.drafts[patient.id] || { complaint:'',anamnesis:'',exam:'',assessment:'',plan:'',temperature:'',pulse:'',respiration:'' };
    const treatments = state.treatments.filter((item) => item.patientId === patient.id);
    return shell('Приём и лечение','Структурированный черновик осмотра, назначения, согласия и завершение визита.',
      `<form id="v48-visit-form" class="v48-visit-layout" data-patient-id="${patient.id}">
        <aside class="v48-grid v48-visit-sidebar"><section class="v48-panel">${patientSummary(patient,'visit')}</section><section class="v48-panel"><h3>Раздельные статусы</h3><div class="v48-activity-list" style="margin-top:10px"><div class="v48-activity"><time>Запись</time><span><strong>Подтверждена</strong></span></div><div class="v48-activity"><time>Визит</time><span><strong>Черновик осмотра</strong></span></div><div class="v48-activity"><time>Оплата</time><span><strong>После закрытия визита</strong></span></div></div></section></aside>
        <section class="v48-panel"><div class="v48-panel-head"><div><h2>Клиническая запись</h2><p>Обязательные поля отмечаются до завершения, черновик можно сохранить раньше.</p></div><span class="v48-status purple">Черновик</span></div><div class="v48-form-grid">
          <label class="v48-field v48-field--wide"><span>Жалоба владельца</span><textarea name="complaint" required>${esc(draft.complaint)}</textarea></label>
          <label class="v48-field v48-field--wide"><span>Анамнез</span><textarea name="anamnesis">${esc(draft.anamnesis)}</textarea></label>
          <label class="v48-field"><span>Температура, °C</span><input name="temperature" inputmode="decimal" value="${esc(draft.temperature)}"/></label><label class="v48-field"><span>Пульс, уд/мин</span><input name="pulse" inputmode="numeric" value="${esc(draft.pulse)}"/></label><label class="v48-field"><span>Дыхание, в минуту</span><input name="respiration" inputmode="numeric" value="${esc(draft.respiration)}"/></label><label class="v48-field"><span>Вес</span><input value="${esc(patient.weight)}" readonly/></label>
          <label class="v48-field v48-field--wide"><span>Объективный осмотр</span><textarea name="exam" required placeholder="Результаты осмотра без неподтверждённых выводов">${esc(draft.exam)}</textarea></label>
          <label class="v48-field v48-field--wide"><span>Предварительная оценка</span><textarea name="assessment" placeholder="Рабочая оценка и дифференциальные варианты">${esc(draft.assessment)}</textarea></label>
          <label class="v48-field v48-field--wide"><span>План и следующий шаг</span><textarea name="plan" required placeholder="Что делать владельцу, когда контроль, какие опасные признаки">${esc(draft.plan)}</textarea></label>
        </div>
        <div class="v48-panel-head" style="margin-top:16px"><div><h3>Процедуры и назначения</h3><p>Цена добавляется в чек только после согласия владельца.</p></div><button class="v48-mini-button" type="button" data-add-treatment>Добавить</button></div><div class="v48-grid">${treatments.length ? treatments.map((item) => `<div class="v48-treatment-row"><span><strong>${esc(item.name)}</strong><small>Согласие: ${esc(item.consent)}</small></span><label class="v48-field"><span>Количество</span><input value="${esc(item.qty)}"/></label><label class="v48-field"><span>Цена</span><input value="${esc(item.price)}"/></label><button class="v48-mini-button danger" type="button" data-remove-treatment="${item.id}">Убрать</button></div>`).join('') : '<div class="v48-empty">Процедуры ещё не добавлены</div>'}</div>
        <div class="bh-clinic-impact bh-clinic-impact--success"><strong>После завершения</strong><span>история пациента обновится. Если прикрепить результат, его можно сразу передать владельцу без отдельной переписки.</span></div><div class="v48-panel-actions" style="margin-top:16px"><button class="btn secondary" type="submit" name="intent" value="draft">Сохранить черновик</button><button class="btn" type="submit" name="intent" value="complete">Завершить визит</button></div></section>
        <aside class="v48-grid"><section class="v48-panel"><div class="v48-panel-head"><div><h2>Согласия</h2><p>Отдельное решение для каждой дополнительной услуги.</p></div></div>${treatments.map((item) => `<div class="v48-consent-card"><strong>${esc(item.name)} · ${esc(item.price)}</strong><small>Владелец увидит причину, цену и сможет отказаться.</small><div class="v48-panel-actions"><button class="v48-mini-button primary" type="button" data-treatment-consent="approve" data-id="${item.id}">Согласовано</button><button class="v48-mini-button" type="button" data-treatment-consent="decline" data-id="${item.id}">Отказ</button></div></div>`).join('') || '<p class="muted small">Нет услуг, требующих согласия.</p>'}</section><section class="v48-panel"><div class="v48-panel-head"><div><h2>Документы</h2></div><button class="v48-mini-button" type="button" data-upload-result="${patient.id}">Прикрепить результат</button></div><div class="v48-activity-list"><div class="v48-activity"><time>12 мая</time><span><strong>Рентген</strong><small>Источник: ВетКлиника+</small></span></div><div class="v48-activity"><time>18 июня</time><span><strong>Заключение терапевта</strong><small>Подписано Анной Смирновой</small></span></div></div></section></aside>
      </form>`
    );
  }

  function telemedDetail() {
    const item = telemedById(state.selectedTelemed) || state.telemed[0];
    const patient = patientById(item.patientId); const doctor = resourceById(item.doctorId);
    const red = item.redFlags !== 'Не отмечены';
    return `<div class="v48-panel-head"><div><h2>${esc(patient.name)} · ${esc(item.topic)}</h2><p>${esc(patient.owner)} · ${esc(patient.phone)}</p></div>${statusBadge(item.status)}</div>
      ${red ? `<div class="v48-alert">${icon('allergy')}<span><strong>Требуется очная оценка срочности</strong><small>${esc(item.redFlags)}. Онлайн-консультация не должна задерживать обращение в клинику.</small></span></div>` : ''}
      <div class="v48-call-preview" style="margin-top:12px"><img src="${assetUrl('assets/images/telemed-doctor-front.webp')}" alt="Превью комнаты онлайн-консультации"/><div class="v48-call-preview__overlay"><span><strong>${esc(doctor.name)}</strong><small>${esc(item.status === 'in-call' ? 'В комнате с владельцем' : 'Комната ещё не открыта')}</small></span><span class="v48-status ${item.quality === 'Хорошая' ? 'green' : 'orange'}">Связь: ${esc(item.quality)}</span></div></div>
      <div class="v48-quality-row" style="margin-top:10px"><div class="v48-fact"><span>Ожидание</span><strong>${esc(item.wait)}</strong></div><div class="v48-fact"><span>Документы</span><strong>${item.documents}</strong></div><div class="v48-fact"><span>Источник</span><strong>${esc(item.source)}</strong></div></div>
      <div class="v48-fact-grid" style="margin-top:10px"><div class="v48-fact"><span>Пациент</span><strong>${esc(patient.species)} · ${esc(patient.breed)} · ${esc(patient.age)}</strong></div><div class="v48-fact"><span>Ограничения</span><strong>${esc(patient.allergies.join(' · ') || 'Не указаны')}</strong></div></div>
      <label class="v48-field" style="margin-top:12px"><span>Заметки консультации</span><textarea placeholder="Симптомы, вопросы владельца и следующий безопасный шаг"></textarea></label>
      <div class="v48-panel-actions" style="margin-top:12px">${item.status !== 'in-call' ? `<button class="btn" type="button" data-telemed-action="start" data-id="${item.id}">Начать консультацию</button>` : `<button class="btn" type="button" data-telemed-action="complete" data-id="${item.id}">Завершить</button>`}<button class="btn secondary" type="button" data-telemed-action="route" data-id="${item.id}">Направить в клинику</button><a class="btn secondary" href="tel:${patient.phone.replace(/[^+\d]/g,'')}">Позвонить</a></div>`;
  }
  function telemedPage() {
    return shell('Телемедицина','Очередь обращений, проверка опасных признаков, качество связи и передача в очный маршрут.',
      `<div class="v48-telemed-layout"><aside class="v48-panel"><div class="v48-panel-head"><div><h2>Онлайн-очередь</h2><p>${state.telemed.filter((item) => ['waiting','needs-route'].includes(item.status)).length} обращения требуют действия.</p></div><span class="v48-status green">4 врача онлайн</span></div><div class="v48-telemed-list">${state.telemed.map((item) => { const patient = patientById(item.patientId); return `<button class="v48-telemed-item ${state.selectedTelemed === item.id ? 'is-selected' : ''}" type="button" data-select-telemed="${item.id}"><img src="${patient.avatar}" alt=""/><span><strong>${esc(patient.name)} · ${esc(item.topic)}</strong><small>${esc(item.wait)} · ${esc(item.redFlags)}</small></span>${statusBadge(item.status)}</button>`; }).join('')}</div></aside><section class="v48-panel">${telemedDetail()}</section></div>`
    );
  }

  function renderAll() {
    const renderers = {
      'clinic-workspace': dashboardPage,
      'clinic-schedule': schedulePage,
      'clinic-appointments': appointmentsPage,
      'clinic-patients': patientsPage,
      'clinic-patient': patientPage,
      'clinic-visit': visitPage,
      'clinic-telemed': telemedPage
    };
    Object.entries(renderers).forEach(([id, renderer]) => {
      const page = document.getElementById(id);
      if (page) page.innerHTML = renderer();
    });
    document.body.dataset.clinicRole = state.role;
    updateRouteChrome();
  }

  function updateRouteChrome() {
    const route = currentRoute();
    document.body.classList.toggle('admin-route', ADMIN_ROUTES.has(route));
    $$('.v48-admin-tabs a').forEach((link) => {
      const active = link.getAttribute('href') === `#${route}` || (route === 'clinic-patient' && link.getAttribute('href') === '#clinic-patients');
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    if (ADMIN_ROUTES.has(route)) document.title = `VetHelp — ${({'clinic-workspace':'сводка клиники','clinic-schedule':'слоты клиники','clinic-appointments':'записи клиники','clinic-patients':'пациенты клиники','clinic-patient':'карточка пациента','clinic-visit':'приём и лечение','clinic-telemed':'телемедицина клиники','clinic-staff':'сотрудники клиники','clinic-services':'услуги клиники','clinic-profile':'профиль клиники','clinic-quality':'качество клиники','clinic-settings':'настройки клиники','clinic-notifications':'уведомления клиники'})[route]}`;
  }

  function ensureDialog() {
    if ($('#v48-admin-dialog')) return;
    document.body.insertAdjacentHTML('beforeend', `<dialog class="v48-dialog" id="v48-admin-dialog"><div class="v48-dialog__head"><div><span class="kicker">VetHelp · клиника</span><h2 id="v48-dialog-title"></h2></div><button type="button" data-dialog-close aria-label="Закрыть">×</button></div><div class="v48-dialog__body" id="v48-dialog-body"></div><div class="v48-dialog__actions" id="v48-dialog-actions"></div></dialog><div class="v48-toast" id="v48-admin-toast" role="status" aria-live="polite" hidden></div>`);
  }
  function openDialog(title, body, actions = '') {
    const dialog = $('#v48-admin-dialog');
    $('#v48-dialog-title').textContent = title;
    $('#v48-dialog-body').innerHTML = body;
    $('#v48-dialog-actions').innerHTML = actions;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
  }
  function closeDialog() { const dialog = $('#v48-admin-dialog'); if (dialog?.open && dialog.close) dialog.close(); else dialog?.removeAttribute('open'); }
  let toastTimer;
  function toast(message) {
    const host = $('#v48-admin-toast'); if (!host) return;
    host.textContent = message; host.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { host.hidden = true; }, 4200);
  }
  function commit(message) { persist(); renderAll(); toast(message); }

  function slotModal(prefill = {}) {
    openDialog('Создать рабочий слот', `<form id="v48-slot-form" class="v48-form-grid">
      <label class="v48-field"><span>Время</span><input name="time" type="time" value="${esc(prefill.time || '14:00')}" required/></label>
      <label class="v48-field"><span>Длительность</span><select name="duration"><option value="30">30 минут</option><option value="45">45 минут</option><option value="60">60 минут</option></select></label>
      <label class="v48-field v48-field--wide"><span>Врач или ресурс</span><select name="resource">${resources.map((resource) => `<option value="${resource.id}" ${prefill.resource === resource.id ? 'selected' : ''}>${esc(resource.name)} · ${esc(resource.meta)}</option>`).join('')}</select></label>
      <label class="v48-field"><span>Формат</span><select name="type"><option value="clinic">В клинике</option><option value="telemed">Онлайн</option></select></label>
      <label class="v48-field"><span>Состояние</span><select name="status"><option value="open">Доступен</option><option value="blocked">Заблокирован</option></select></label>
    </form>`, `<button class="btn secondary" type="button" data-dialog-close>Отмена</button><button class="btn" type="submit" form="v48-slot-form">Создать слот</button>`);
  }
  function appointmentModal() {
    openDialog('Добавить запись', `<form id="v48-appointment-form" class="v48-form-grid">
      <label class="v48-field v48-field--wide"><span>Пациент</span><select name="patient">${state.patients.map((patient) => `<option value="${patient.id}">${esc(patient.name)} · ${esc(patient.owner)}</option>`).join('')}</select></label>
      <label class="v48-field"><span>Время</span><input name="time" type="time" value="14:00" required/></label>
      <label class="v48-field"><span>Формат</span><select name="channel"><option value="clinic">В клинике</option><option value="telemed">Онлайн</option></select></label>
      <label class="v48-field v48-field--wide"><span>Услуга</span><input name="service" value="Консультация терапевта" required/></label>
      <label class="v48-field"><span>Врач</span><select name="doctor">${resources.map((resource) => `<option value="${resource.id}">${esc(resource.name)}</option>`).join('')}</select></label>
      <label class="v48-field"><span>Цена</span><input name="price" value="1 200 ₽"/></label>
      <label class="v48-field v48-field--wide"><span>Комментарий</span><textarea name="note" placeholder="Причина обращения и важный контекст"></textarea></label>
    </form>`, `<button class="btn secondary" type="button" data-dialog-close>Отмена</button><button class="btn" type="submit" form="v48-appointment-form">Добавить</button>`);
  }
  function patientModal() {
    openDialog('Добавить пациента', `<form id="v48-patient-form" class="v48-form-grid">
      <label class="v48-field"><span>Кличка</span><input name="name" required/></label><label class="v48-field"><span>Вид</span><select name="species"><option>Собака</option><option>Кошка</option><option>Птица</option><option>Кролик</option><option>Другое</option></select></label>
      <label class="v48-field"><span>Порода</span><input name="breed"/></label><label class="v48-field"><span>Возраст</span><input name="age" placeholder="2 года"/></label>
      <label class="v48-field"><span>Владелец</span><input name="owner" required/></label><label class="v48-field"><span>Телефон</span><input name="phone" type="tel" required/></label>
      <label class="v48-field v48-field--wide"><span>Аллергии и ограничения</span><input name="allergies" placeholder="Через запятую; подтверждаются врачом"/></label>
    </form>`, `<button class="btn secondary" type="button" data-dialog-close>Отмена</button><button class="btn" type="submit" form="v48-patient-form">Создать карточку</button>`);
  }
  function treatmentModal() {
    openDialog('Добавить процедуру или назначение', `<form id="v48-treatment-form" class="v48-form-grid">
      <label class="v48-field v48-field--wide"><span>Наименование</span><input name="name" required placeholder="Например, анализ крови"/></label><label class="v48-field"><span>Количество</span><input name="qty" value="1"/></label><label class="v48-field"><span>Цена</span><input name="price" placeholder="0 ₽"/></label>
    </form>`, `<button class="btn secondary" type="button" data-dialog-close>Отмена</button><button class="btn" type="submit" form="v48-treatment-form">Добавить</button>`);
  }

  function documentModal(patientId) {
    const patient = patientById(patientId); if (!patient) return;
    openDialog(`Загрузить результат · ${patient.name}`, `<form id="v48-document-form" class="v48-form-grid clinic-upload-form" data-patient-id="${patient.id}">
      <label class="v48-field v48-field--wide clinic-file-drop" data-file-drop>
        <span class="clinic-field-label">Файл результата</span>
        <input class="clinic-file-input" name="file" type="file" accept=".pdf,.doc,.docx,image/*" required/>
        <span class="clinic-file-drop__zone">
          <span class="clinic-file-drop__icon" aria-hidden="true">${icon('lab')}</span>
          <span class="clinic-file-drop__copy"><strong>Перетащите файл сюда</strong><small>или выберите его с компьютера</small></span>
          <span class="clinic-file-button">Выбрать файл</span>
        </span>
        <span class="clinic-file-selected" data-file-name>Файл не выбран</span>
        <small class="clinic-file-hint">PDF, DOC/DOCX, JPG или PNG · до 20 МБ</small>
      </label>
      <label class="v48-field clinic-dialog-field"><span>Тип документа</span><select name="kind"><option>Заключение</option><option>Анализы</option><option>Диагностика</option><option>Назначения</option><option>Рекомендации</option><option>Другое</option></select></label>
      <label class="v48-field clinic-dialog-field"><span>Автор</span><input name="author" value="Анна Смирнова"/></label>
      <label class="v48-field v48-field--wide clinic-dialog-field"><span>Комментарий владельцу</span><textarea name="note" rows="3" placeholder="Что загружено и что владельцу делать дальше"></textarea></label>
      <label class="clinic-share-check v48-field--wide"><input name="share" type="checkbox" checked/><span><strong>Отправить владельцу после загрузки</strong><small>Документ появится в Pet Diary и истории визита.</small></span></label>
    </form>`, `<button class="btn secondary" type="button" data-dialog-close>Отмена</button><button class="btn" type="submit" form="v48-document-form" data-document-submit disabled>Загрузить результат</button>`);
  }

  function fileModal(patientId, fileId) {
    const patient = patientById(patientId); const file = patient?.files?.find((item) => item.id === fileId); if (!file) return;
    const preview = filePreviewUrl(file);
    openDialog(file.name, `<div class="clinic-file-viewer">${preview ? `<img src="${preview}" alt="${esc(file.name)}"/>` : `<div class="clinic-file-placeholder">${icon(file.kind === 'Анализы' ? 'lab' : 'visit')}<strong>${esc(file.kind)}</strong><small>${esc(file.name)}</small></div>`}<div class="v48-fact-grid"><div class="v48-fact"><span>Дата</span><strong>${esc(file.date)}</strong></div><div class="v48-fact"><span>Автор</span><strong>${esc(file.author)}</strong></div><div class="v48-fact"><span>Источник</span><strong>${esc(file.source || 'ВетКлиника+')}</strong></div><div class="v48-fact"><span>Владелец</span><strong>${file.shared ? 'Документ отправлен' : 'Ещё не отправлен'}</strong></div></div></div>`, `<button class="btn secondary" type="button" data-dialog-close>Закрыть</button>${file.shared ? '' : `<button class="btn" type="button" data-send-file="${file.id}" data-patient-id="${patient.id}">Отправить владельцу</button>`}`);
  }


  function handleAppointmentAction(action, id) {
    const item = appointmentById(id); if (!item) return;
    if (action === 'confirm') { item.status = 'confirmed'; const linked = state.slots.find((slot) => slot.appointmentId === id); if (linked) linked.status = linked.type === 'telemed' ? 'telemed' : 'booked'; addAudit(`Подтверждена запись ${id}`, 'Светлана Котова · ресепшен'); }
    if (action === 'checkin') { item.status = 'checkedin'; addAudit(`Пациент отмечен в клинике · ${id}`, 'Светлана Котова · ресепшен'); }
    if (action === 'visit') { item.status = 'in-visit'; state.selectedPatient = item.patientId; state.selectedAppointment = id; addAudit(`Открыт приём ${id}`, 'Анна Смирнова · врач'); persist(); renderAll(); location.hash = '#clinic-visit'; return; }
    if (action === 'cancel') { item.status = 'cancelled'; const linked = state.slots.find((slot) => slot.appointmentId === id); if (linked) { linked.status = 'open'; linked.appointmentId = null; linked.label = 'Свободное окно после отмены'; } addAudit(`Отменена запись ${id}`, 'Сотрудник клиники'); }
    if (action === 'reschedule') { item.status = 'needs-info'; addAudit(`Запрошено другое время · ${id}`, 'Светлана Котова · ресепшен'); }
    commit(`Статус записи ${id} обновлён.`);
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const role = event.target.closest('[data-admin-role]');
      if (role) { state.role = role.dataset.adminRole; addAudit(`Роль интерфейса: ${state.role === 'doctor' ? 'Врач' : state.role === 'admin' ? 'Админ' : 'Ресепшен'}`); commit('Ролевой режим изменён. В рабочей системе права проверяются сервером.'); return; }
      if (event.target.closest('[data-admin-reset]')) { state = clone(initialState); persist(); renderAll(); toast('Демо-данные восстановлены.'); return; }
      if (event.target.closest('[data-dialog-close]')) { closeDialog(); return; }
      if (event.target.closest('[data-open-slot-modal]')) { slotModal(); return; }
      if (event.target.closest('[data-open-appointment-modal]')) { appointmentModal(); return; }
      if (event.target.closest('[data-open-patient-modal]')) { patientModal(); return; }
      if (event.target.closest('[data-add-treatment]')) { treatmentModal(); return; }
      const emptySlot = event.target.closest('[data-empty-slot]');
      if (emptySlot) { slotModal({time:emptySlot.dataset.time,resource:emptySlot.dataset.resource}); return; }
      const slot = event.target.closest('[data-slot-id]');
      if (slot) { state.selectedSlot = slot.dataset.slotId; persist(); renderAll(); return; }
      const slotToggle = event.target.closest('[data-slot-toggle]');
      if (slotToggle) { const item = state.slots.find((entry) => entry.id === slotToggle.dataset.slotToggle); if (item) { item.status = item.status === 'blocked' ? 'open' : 'blocked'; item.label = item.status === 'blocked' ? 'Заблокировано сотрудником' : 'Свободное окно'; addAudit(`${item.status === 'blocked' ? 'Заблокирован' : 'Открыт'} слот ${item.time}`, 'Сотрудник клиники'); commit(item.status === 'open' ? 'Слот открыт — он может появиться владельцам при активной услуге.' : 'Слот закрыт — новые владельцы больше не увидят это время.'); } return; }
      const appointmentRow = event.target.closest('[data-appointment-row]');
      if (appointmentRow) { state.selectedAppointment = appointmentRow.dataset.appointmentRow; persist(); renderAll(); return; }
      const openAppointment = event.target.closest('[data-open-appointment]');
      if (openAppointment) { state.selectedAppointment = openAppointment.dataset.openAppointment; persist(); renderAll(); location.hash = '#clinic-appointments'; return; }
      const appointmentAction = event.target.closest('[data-appointment-action]');
      if (appointmentAction) { handleAppointmentAction(appointmentAction.dataset.appointmentAction, appointmentAction.dataset.id); return; }
      const filter = event.target.closest('[data-appointment-filter]');
      if (filter) { state.appointmentFilter = filter.dataset.appointmentFilter; persist(); renderAll(); return; }
      const selectPatient = event.target.closest('[data-select-patient]');
      if (selectPatient) { state.selectedPatient = selectPatient.dataset.selectPatient; persist(); renderAll(); return; }
      const openPatient = event.target.closest('[data-open-patient]');
      if (openPatient) { state.selectedPatient = openPatient.dataset.openPatient; persist(); renderAll(); location.hash = '#clinic-patient'; return; }
      if (event.target.closest('[data-back-patients]')) { location.hash = '#clinic-patients'; return; }
      const uploadResult = event.target.closest('[data-upload-result]');
      if (uploadResult) { documentModal(uploadResult.dataset.uploadResult); return; }
      const openFile = event.target.closest('[data-open-file]');
      if (openFile) { fileModal(openFile.dataset.patientId, openFile.dataset.openFile); return; }
      const sendFile = event.target.closest('[data-send-file]');
      if (sendFile) { const patient = patientById(sendFile.dataset.patientId); const file = patient?.files?.find((item) => item.id === sendFile.dataset.sendFile); if (file) { file.shared = true; addAudit(`Документ отправлен владельцу: ${file.name}`, 'Сотрудник клиники'); closeDialog(); commit('Документ отправлен владельцу и остаётся в истории пациента.'); } return; }
      const startVisit = event.target.closest('[data-start-visit]');
      if (startVisit) { state.selectedPatient = startVisit.dataset.startVisit; if (!state.drafts[state.selectedPatient]) state.drafts[state.selectedPatient] = { complaint:'',anamnesis:'',exam:'',assessment:'',plan:'',temperature:'',pulse:'',respiration:'' }; persist(); renderAll(); location.hash = '#clinic-visit'; return; }
      const startTelemed = event.target.closest('[data-start-telemed]');
      if (startTelemed) { const id = `T-${Date.now().toString().slice(-4)}`; state.telemed.unshift({id,patientId:startTelemed.dataset.startTelemed,doctorId:'anna',status:'scheduled',wait:'По записи',topic:'Повторная консультация',redFlags:'Не отмечены',quality:'Не проверена',source:'Карточка пациента',documents:0}); state.selectedTelemed = id; addAudit(`Создана онлайн-консультация ${id}`); persist(); renderAll(); location.hash = '#clinic-telemed'; return; }
      const selectTelemed = event.target.closest('[data-select-telemed]');
      if (selectTelemed) { state.selectedTelemed = selectTelemed.dataset.selectTelemed; persist(); renderAll(); return; }
      const telemedAction = event.target.closest('[data-telemed-action]');
      if (telemedAction) { const item = telemedById(telemedAction.dataset.id); if (!item) return; const action = telemedAction.dataset.telemedAction; if (action === 'start') item.status = 'in-call'; if (action === 'complete') item.status = 'completed'; if (action === 'route') item.status = 'needs-route'; addAudit(`Телемедицина ${item.id}: ${statusMeta(item.status)[0]}`, 'Анна Смирнова · врач'); commit(`Статус консультации ${item.id} обновлён.`); return; }
      const removeTreatment = event.target.closest('[data-remove-treatment]');
      if (removeTreatment) { state.treatments = state.treatments.filter((item) => item.id !== removeTreatment.dataset.removeTreatment); commit('Процедура убрана из черновика.'); return; }
      const consent = event.target.closest('[data-treatment-consent]');
      if (consent) { const item = state.treatments.find((entry) => entry.id === consent.dataset.id); if (item) { item.consent = consent.dataset.treatmentConsent === 'approve' ? 'Согласовано' : 'Отказ владельца'; addAudit(`${item.name}: ${item.consent}`, 'Врач · согласие владельца'); commit('Решение владельца сохранено в журнале прототипа.'); } return; }
    });

    document.addEventListener('input', (event) => {
      if (event.target.matches('.clinic-file-input')) {
        const form = event.target.closest('#v48-document-form');
        const name = form?.querySelector('[data-file-name]');
        const submit = document.querySelector('[data-document-submit]');
        const file = event.target.files?.[0];
        if (name) name.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : 'Файл не выбран';
        if (submit) submit.disabled = !file;
        event.target.closest('[data-file-drop]')?.classList.toggle('has-file', Boolean(file));
      }
      if (event.target.matches('[data-patient-search]')) {
        state.patientQuery = event.target.value;
        clearTimeout(event.target._searchTimer);
        event.target._searchTimer = setTimeout(() => { persist(); renderAll(); const input = $('[data-patient-search]'); if (input) { input.focus(); input.setSelectionRange(input.value.length,input.value.length); } }, 180);
      }
      if (event.target.matches('#v48-appointment-search')) {
        const query = event.target.value.toLowerCase();
        $$('#clinic-appointments [data-appointment-row]').forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(query); });
      }
    });

    document.addEventListener('dragover', (event) => {
      const drop = event.target.closest?.('[data-file-drop]');
      if (!drop) return;
      event.preventDefault();
      drop.classList.add('is-dragover');
    });
    document.addEventListener('dragleave', (event) => {
      const drop = event.target.closest?.('[data-file-drop]');
      if (!drop) return;
      drop.classList.remove('is-dragover');
    });
    document.addEventListener('drop', (event) => {
      const drop = event.target.closest?.('[data-file-drop]');
      if (!drop) return;
      event.preventDefault();
      drop.classList.remove('is-dragover');
      const input = drop.querySelector('.clinic-file-input');
      const files = event.dataTransfer?.files;
      if (!input || !files?.length) return;
      try { input.files = files; } catch (_) { return; }
      input.dispatchEvent(new Event('input', {bubbles:true}));
    });

    document.addEventListener('keydown', (event) => {
      const row = event.target.closest('[data-appointment-row]');
      if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); row.click(); }
      if (event.key === 'Escape') closeDialog();
    });

    document.addEventListener('submit', async (event) => {
      const form = event.target;
      if (form.id === 'v48-document-form') {
        event.preventDefault(); const patient = patientById(form.dataset.patientId); const data = new FormData(form); const input = form.elements.file; const selected = input?.files?.[0];
        if (!patient || !selected) { toast('Выберите файл результата.'); return; }
        const id = `F-${Date.now().toString().slice(-6)}`; const today = new Date().toLocaleDateString('ru-RU');
        let preview = null;
        if (selected.type?.startsWith('image/') && selected.size <= 450000) {
          preview = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(null); reader.readAsDataURL(selected); });
        }
        if (!Array.isArray(patient.files)) patient.files = [];
        const shared = data.get('share') === 'on';
        patient.files.unshift({id,kind:data.get('kind') || 'Документ',name:selected.name,date:today,author:data.get('author') || 'Сотрудник клиники',source:'Загружено клиникой',shared,preview,size:formatBytes(selected.size),note:data.get('note') || ''});
        patient.documents = patient.files.length;
        patient.records.unshift({date:today,title:`${data.get('kind') || 'Документ'}: ${selected.name}`,copy:shared ? 'Результат загружен клиникой и отправлен владельцу.' : 'Результат загружен клиникой и пока доступен только сотрудникам.',doctor:data.get('author') || 'Сотрудник клиники'});
        addAudit(`Загружен результат ${selected.name}${shared ? ' и отправлен владельцу' : ''}`, data.get('author') || 'Сотрудник клиники'); closeDialog(); commit(shared ? 'Результат загружен и отправлен владельцу.' : 'Результат загружен в карточку пациента.'); return;
      }
      if (form.id === 'v48-slot-form') {
        event.preventDefault(); const data = new FormData(form); const id = `S-${Date.now().toString().slice(-5)}`;
        const collision = state.slots.find((slot) => slot.time === data.get('time') && slot.resourceId === data.get('resource'));
        if (collision) { toast('Для этого ресурса окно на выбранное время уже существует.'); return; }
        state.slots.push({ id, time:data.get('time'), resourceId:data.get('resource'), duration:Number(data.get('duration')), type:data.get('type'), status:data.get('status') === 'blocked' ? 'blocked' : data.get('type') === 'telemed' ? 'telemed' : 'open', label:data.get('status') === 'blocked' ? 'Служебная блокировка' : 'Свободное окно' }); state.selectedSlot = id; addAudit(`Создан слот ${data.get('time')}`, 'Светлана Котова · ресепшен'); closeDialog(); commit('Новый слот добавлен в расписание.'); return;
      }
      if (form.id === 'v48-appointment-form') {
        event.preventDefault(); const data = new FormData(form); const id = `A-${Date.now().toString().slice(-5)}`; const channel = data.get('channel');
        const existingSlot = state.slots.find((slot) => slot.time === data.get('time') && slot.resourceId === data.get('doctor'));
        if (existingSlot && !['open'].includes(existingSlot.status)) { toast('У выбранного врача это время занято. Запись не создана.'); return; }
        state.appointments.push({ id, time:data.get('time'), patientId:data.get('patient'), service:data.get('service'), doctorId:data.get('doctor'), room:channel === 'telemed' ? 'Онлайн' : 'Каб. 2', status:channel === 'telemed' ? 'telemed-wait' : 'confirmed', source:'Ручная запись', channel, price:data.get('price') || 'Уточняется', risk:'Проверить карточку', created:nowTime(), note:data.get('note') || 'Комментарий не добавлен' });
        if (existingSlot) { existingSlot.status = channel === 'telemed' ? 'telemed' : 'booked'; existingSlot.type = channel; existingSlot.appointmentId = id; existingSlot.label = ''; }
        else state.slots.push({id:`S-${Date.now().toString().slice(-5)}`,time:data.get('time'),resourceId:data.get('doctor'),duration:30,type:channel,status:channel === 'telemed' ? 'telemed' : 'booked',appointmentId:id});
        state.selectedAppointment = id; addAudit(`Добавлена ручная запись ${id}`, 'Светлана Котова · ресепшен'); closeDialog(); commit('Запись добавлена и связана со слотом.'); return;
      }
      if (form.id === 'v48-patient-form') {
        event.preventDefault(); const data = new FormData(form); const id = `P-${String(state.patients.length + 1).padStart(3,'0')}`;
        state.patients.push({ id,name:data.get('name'),species:data.get('species'),breed:data.get('breed') || 'Не указана',sex:'Не указан',birth:'Не указана',age:data.get('age') || 'Не указан',weight:'Не указан',avatar:assetUrl('assets/images/pet-lucky.webp'),owner:data.get('owner'),phone:data.get('phone'),email:'Не указан',allergies:String(data.get('allergies') || '').split(',').map((item) => item.trim()).filter(Boolean),conditions:[],policy:'Полиса нет',lastVisit:'—',documents:0,files:[],balance:'0 ₽',records:[] }); state.selectedPatient = id; addAudit(`Создана карточка пациента ${data.get('name')}`, 'Светлана Котова · ресепшен'); closeDialog(); commit('Карточка пациента создана.'); return;
      }
      if (form.id === 'v48-treatment-form') {
        event.preventDefault(); const data = new FormData(form); state.treatments.push({id:`TR-${Date.now().toString().slice(-5)}`,patientId:state.selectedPatient,name:data.get('name'),qty:data.get('qty') || '1',price:data.get('price') || 'Уточняется',consent:'Ожидается'}); closeDialog(); commit('Процедура добавлена в черновик и ожидает согласия.'); return;
      }
      if (form.id === 'v48-visit-form') {
        event.preventDefault(); const data = new FormData(form); const patientId = form.dataset.patientId; const intent = event.submitter?.value || 'draft';
        state.drafts[patientId] = {complaint:data.get('complaint'),anamnesis:data.get('anamnesis'),exam:data.get('exam'),assessment:data.get('assessment'),plan:data.get('plan'),temperature:data.get('temperature'),pulse:data.get('pulse'),respiration:data.get('respiration')};
        if (intent === 'complete') {
          if (!data.get('complaint') || !data.get('exam') || !data.get('plan')) { toast('Заполните жалобу, результаты осмотра и следующий шаг.'); return; }
          const pendingConsent = state.treatments.some((item) => item.patientId === patientId && item.consent === 'Ожидается');
          if (pendingConsent) { toast('Сначала зафиксируйте решение владельца по дополнительным услугам.'); return; }
          const patient = patientById(patientId); patient.records.unshift({date:'10.07.2026',title:'Приём терапевта',copy:data.get('assessment') || data.get('plan'),doctor:'Анна Смирнова'}); patient.lastVisit = '10.07.2026'; const active = state.appointments.find((item) => item.patientId === patientId && ['checkedin','in-visit','confirmed'].includes(item.status)); if (active) active.status = 'done'; addAudit(`Завершён визит пациента ${patient.name}`, 'Анна Смирнова · врач'); commit('Визит завершён. История пациента обновлена; результаты можно сразу передать владельцу.');
        } else { addAudit(`Сохранён черновик приёма ${patientById(patientId).name}`, 'Анна Смирнова · врач'); commit('Черновик приёма сохранён локально.'); }
      }
    });

    window.addEventListener('hashchange', () => { updateRouteChrome(); setTimeout(() => $$('.v48-admin-tabs a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === location.hash || (currentRoute() === 'clinic-patient' && link.getAttribute('href') === '#clinic-patients'))), 0); });
  }

  function init() {
    ensureDialog();
    renderAll();
    bindEvents();
    updateRouteChrome();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
