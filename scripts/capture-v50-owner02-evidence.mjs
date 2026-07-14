import { mkdir, writeFile } from 'node:fs/promises';

const root = process.env.V50_EVIDENCE_ROOT;
const mode = process.env.V50_EVIDENCE_MODE ?? 'runtime';
if (!root) throw new Error('V50_EVIDENCE_ROOT is required');

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Chrome page target was not found');

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

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const viewports = [
  [375, 812],
  [412, 915],
  [768, 1024],
  [1440, 900],
];
const states = {
  pets: ['PETS_READY', 'PETS_EMPTY', 'PETS_OFFLINE_STALE'],
  profile: ['PROFILE_READY', 'PROFILE_WITH_WARNING', 'PROFILE_EDIT', 'PROFILE_CONFLICT'],
  diary: ['DIARY_READY', 'DIARY_EMPTY', 'DIARY_PROCESSING', 'DIARY_REVIEW_REQUIRED', 'DIARY_DOCUMENT_PREVIEW'],
};

await command('Page.enable');
for (const [width, height] of viewports) {
  await command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  if (mode === 'runtime') {
    for (const [group, names] of Object.entries(states)) {
      for (const state of names) {
        await capture(
          `http://127.0.0.1:8765/?state=${state}`,
          `${root}/${group}/${width}x${height}/${state}.png`,
          2500,
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
      );
    }
  }
}
socket.close();

async function capture(url, file, delay) {
  await command('Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, delay));
  const { data } = await command('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false, fromSurface: true,
  });
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, Buffer.from(data, 'base64'));
}
