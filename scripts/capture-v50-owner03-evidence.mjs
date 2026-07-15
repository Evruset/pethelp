import { mkdir, writeFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
const mode = process.env.V50_EVIDENCE_MODE ?? 'runtime';
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');

const allViewports = [[375, 812], [412, 915], [768, 1024], [1440, 900]];
const allStates = [
  'CATALOG_READY_LIST', 'CATALOG_READY_MAP', 'CATALOG_FILTERED',
  'CATALOG_EMPTY', 'CATALOG_LOCATION_DENIED', 'CATALOG_OFFLINE_STALE',
  'CLINIC_READY', 'CLINIC_STALE_AVAILABILITY', 'CLINIC_NO_SLOTS',
  'DOCTORS_READY', 'DOCTORS_EMPTY', 'DOCTOR_PROFILE',
];
const requestedViewports = new Set((process.env.V50_EVIDENCE_VIEWPORTS ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean));
const requestedStates = new Set((process.env.V50_EVIDENCE_STATES ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean));
const viewports = requestedViewports.size === 0 ? allViewports
  : allViewports.filter(([w, h]) => requestedViewports.has(`${w}x${h}`));
const states = requestedStates.size === 0 ? allStates
  : allStates.filter((state) => requestedStates.has(state));
if (viewports.length === 0 || states.length === 0) throw new Error('No supported evidence selection');

for (const [width, height] of viewports) {
  if (mode === 'runtime') {
    for (const state of states) {
      await capture(`http://127.0.0.1:8765/?state=${state}`,
        `${root}/runtime/${width}x${height}/${state}.png`, width, height, 2200);
    }
  } else {
    for (const [name, anchor] of Object.entries({
      catalog: 'catalog', clinic: 'clinic', doctors: 'doctor-select', doctor: 'doctor-detail',
    })) {
      await capture(`http://127.0.0.1:8766/prototype-v50/index.html#${anchor}`,
        `${root}/prototype/${name}/${width}x${height}.png`, width, height, 2500);
    }
  }
}

async function capture(url, file, width, height, delay) {
  const target = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const command = (method, params = {}) => {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  try {
    await command('Page.enable');
    await command('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
    });
    await command('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.V50_EVIDENCE_DELAY_MS ?? delay)));
    const { data } = await command('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false, fromSurface: true,
    });
    await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
    await writeFile(file, Buffer.from(data, 'base64'));
  } finally {
    socket.close();
    await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
  }
}
