const fs = require('fs');

const input = process.env.DEMO_SEED_JSON;
const outputJson = process.env.DEMO_SESSIONS_JSON;
const outputHtml = process.env.DEMO_SESSIONS_HTML;
const portal = (process.env.DEMO_PORTAL_URL || 'http://localhost:3002').replace(/\/$/, '');

if (!input || !outputJson || !outputHtml) {
  throw new Error('DEMO_SEED_JSON, DEMO_SESSIONS_JSON and DEMO_SESSIONS_HTML are required');
}

const seed = JSON.parse(fs.readFileSync(input, 'utf8'));
const sessions = seed.employees.map((profile) => {
  const clinicId = profile.clinicIds[0] || seed.clinic.id;
  const locationId = profile.locationIds[0] || seed.clinic.locations[0].id;
  const base = `${portal}/clinics/${clinicId}/locations/${locationId}`;
  const hasAdministrativeRole =
    profile.tokenRoles.includes('CLINIC_RECEPTIONIST') ||
    profile.tokenRoles.includes('CLINIC_ADMIN');
  const hasVeterinarianRole = profile.tokenRoles.includes('CLINIC_VETERINARIAN');
  const startUrl = hasVeterinarianRole && !hasAdministrativeRole
    ? `${base}/vet/visits`
    : `${base}/queue`;

  return {
    ...profile,
    expectedAccess: profile.expectedAccess === true,
    startUrl,
    queueUrl: `${base}/queue`,
    scheduleUrl: `${base}/schedule`,
    appointmentsUrl: `${base}/appointments`,
    patientsUrl: `${base}/patients`,
    visitsUrl: `${base}/vet/visits`,
  };
});

function privateWrite(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}
privateWrite(outputJson, JSON.stringify({ generatedAt: new Date().toISOString(), portal, clinic: seed.clinic, sessions }, null, 2));

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const cards = sessions.map((session) => {
  const hasAdministrativeRole =
    session.tokenRoles.includes('CLINIC_RECEPTIONIST') ||
    session.tokenRoles.includes('CLINIC_ADMIN');
  const hasVeterinarianRole = session.tokenRoles.includes('CLINIC_VETERINARIAN');

  let actions = '';
  if (!session.expectedAccess) {
    actions = `<a class="deny" href="${esc(`${portal}/api/dev/local-session#profile=${encodeURIComponent(session.key)}`)}">Проверить ожидаемый отказ</a>`;
  } else if (hasVeterinarianRole && !hasAdministrativeRole) {
    actions = [
      `<a class="primary" href="${esc(`${portal}/api/dev/local-session#profile=${encodeURIComponent(session.key)}`)}">Войти как врач</a>`,
      `<a href="${esc(session.visitsUrl)}">Мои визиты</a>`,
    ].join('');
  } else {
    actions = [
      `<a class="primary" href="${esc(`${portal}/api/dev/local-session#profile=${encodeURIComponent(session.key)}`)}">Войти под профилем</a>`,
      `<a href="${esc(session.queueUrl)}">Очередь</a>`,
      `<a href="${esc(session.scheduleUrl)}">Расписание</a>`,
      `<a href="${esc(session.appointmentsUrl)}">Записи</a>`,
      `<a href="${esc(session.patientsUrl)}">Пациенты</a>`,
      hasVeterinarianRole ? `<a href="${esc(session.visitsUrl)}">Мои визиты</a>` : '',
    ].join('');
  }

  return `<article class="card ${session.expectedAccess ? 'allowed' : 'denied'}">
    <div class="row">
      <h2>${esc(session.label)}</h2>
      <span>${esc(session.tokenRoles.join(' + '))}</span>
    </div>
    <p>${esc(session.expected)}</p>
    <div class="status ${session.expectedAccess ? 'ok' : 'blocked'}">
      ${session.expectedAccess ? 'Рабочий доступ' : 'Ожидаемый отказ'}
    </div>
    <code>${esc(session.employeeId)}</code>
    <div class="actions">${actions}</div>
  </article>`;
}).join('');

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VetHelp Demo Sessions</title>
  <style>
    :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}
    body{margin:0;padding:32px;background:#f4f6f8;color:#17202a}
    main{max-width:1180px;margin:auto}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px}
    .card{background:white;border:1px solid #dde3e8;border-radius:18px;padding:18px;box-shadow:0 8px 30px rgba(23,32,42,.07)}
    .card.allowed{border-color:#a6d9ba}.card.denied{border-color:#e3b0b0}
    .row{display:flex;gap:12px;justify-content:space-between}
    .row span{font-size:11px;padding:5px 8px;border-radius:999px;background:#eef4ff;color:#175cd3}
    h2{margin:0;font-size:18px}p{min-height:42px;color:#566573}
    code{display:block;font-size:12px;color:#5d6d7e;overflow-wrap:anywhere;margin-top:10px}
    .status{display:inline-block;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:700}
    .status.ok{background:#eaf8ef;color:#176b3a}.status.blocked{background:#fff0f0;color:#a12222}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
    a{text-decoration:none;border:1px solid #ccd5dd;border-radius:10px;padding:8px 10px;color:#17202a}
    .primary{background:#175cd3;color:white!important;border-color:#175cd3!important}
    .deny{background:#fff3f3;color:#a12222!important;border-color:#e0aaaa!important}
    .note{padding:14px;border-radius:14px;background:#fff8e8;border:1px solid #f3d596;margin:18px 0 24px}
    @media(prefers-color-scheme:dark){
      body{background:#101417;color:#f3f5f7}.card{background:#1c2227;border-color:#303940}
      p,code{color:#b6c0c8}a{color:#f3f5f7;border-color:#46515a}
      .note{background:#302817;border-color:#66562e}
    }
  </style>
</head>
<body>
  <main>
    <h1>VetHelp · демо-профили Clinic Portal</h1>
    <p>12 профилей: 9 рабочих сценариев и 3 контролируемых отказа.</p>
    <div class="note">
      Используется только <strong>localhost:3002</strong>. Сначала нажмите кнопку входа в карточке.
      Для карточек «Ожидаемый отказ» экран 403 является правильным результатом.
    </div>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;

privateWrite(outputHtml, html);
