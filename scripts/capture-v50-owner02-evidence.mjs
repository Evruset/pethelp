import { mkdir, writeFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
const mode = process.env.V50_EVIDENCE_MODE ?? 'runtime';
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');

const allViewports = [
  [375, 812],
  [412, 915],
  [768, 1024],
  [1440, 900],
];
const allStates = {
  pets: ['PETS_READY', 'PETS_EMPTY', 'PETS_OFFLINE_STALE'],
  profile: ['PROFILE_READY', 'PROFILE_WITH_WARNING', 'PROFILE_EDIT', 'PROFILE_CONFLICT'],
  diary: ['DIARY_READY', 'DIARY_EMPTY', 'DIARY_PROCESSING', 'DIARY_REVIEW_REQUIRED', 'DIARY_DOCUMENT_PREVIEW'],
};
const supplementalStates = [
  'PROFILE_VALIDATION_ERROR',
  'PROFILE_ARCHIVED',
  'PROFILE_NOT_FOUND',
  'PROFILE_SESSION_EXPIRED',
  'PROFILE_OFFLINE_STALE',
  'DOCUMENT_ARCHIVED',
  'DOCUMENT_NETWORK_FAILURE',
  'DOCUMENT_FOREIGN',
];
const requestedViewports = new Set(
  (process.env.V50_EVIDENCE_VIEWPORTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const requestedStates = new Set(
  (process.env.V50_EVIDENCE_STATES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const viewports = requestedViewports.size === 0
  ? allViewports
  : allViewports.filter(([width, height]) => requestedViewports.has(`${width}x${height}`));
const availableStates = requestedStates.size === 0
  ? allStates
  : { ...allStates, supplemental: supplementalStates };
const states = Object.fromEntries(
  Object.entries(availableStates).map(([group, names]) => [
    group,
    requestedStates.size === 0
      ? names
      : names.filter((state) => requestedStates.has(state)),
  ]),
);
if (viewports.length === 0) throw new Error('No requested evidence viewport is supported');
if (requestedStates.size > 0 && Object.values(states).every((names) => names.length === 0)) {
  throw new Error('No requested evidence state is supported');
}

for (const [width, height] of viewports) {
  if (mode === 'runtime') {
    for (const [group, names] of Object.entries(states)) {
      for (const state of names) {
        await capture(
          `http://127.0.0.1:8765/?state=${state}`,
          `${root}/${group}/${width}x${height}/${state}.png`,
          2500,
          width,
          height,
        );
      }
    }
  } else if (mode === 'prototype') {
    for (const [group, anchor] of Object.entries({
      pets: 'pets', profile: 'pet-profile', diary: 'diary',
    })) {
      await capture(
        `http://127.0.0.1:8766/prototype-v50/index.html#${anchor}`,
        `${root}/prototype/${group}/${width}x${height}.png`,
        3000,
        width,
        height,
      );
    }
  }
}

async function capture(url, file, delay, width, height) {
  const target = await (await fetch(
    'http://127.0.0.1:9222/json/new?about:blank',
    { method: 'PUT' },
  )).json();
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
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const command = (method, params = {}) => {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  try {
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 247, g: 249, b: 252, a: 1 },
    });
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await command('Page.navigate', { url });
    const requestedDelay = Number(process.env.V50_EVIDENCE_DELAY_MS ?? delay);
    await new Promise((resolve) => setTimeout(resolve, requestedDelay));
    await command('Runtime.evaluate', {
      expression: `document.documentElement.style.background = '#f7f9fc'; document.body.style.background = '#f7f9fc';`,
    });
    await command('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false, fromSurface: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
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
