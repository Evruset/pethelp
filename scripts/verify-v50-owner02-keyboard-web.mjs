const baseUrl = process.env.V50_EVIDENCE_URL ?? 'http://127.0.0.1:8765';
const cases = [
  { state: 'PETS_READY', minimumUnique: 6 },
  { state: 'PROFILE_READY', minimumUnique: 7 },
  { state: 'DIARY_READY', minimumUnique: 9 },
];

for (const testCase of cases) {
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
    await command('Accessibility.enable');
    await command('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await command('Page.navigate', {
      url: `${baseUrl}/?state=${testCase.state}&keyboardProof=1`,
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await command('Runtime.evaluate', {
      expression: `document.querySelector('flt-semantics-placeholder')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const focusSequence = [];
    for (let index = 0; index < 18; index++) {
      await command('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await command('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await new Promise((resolve) => setTimeout(resolve, 75));
      const result = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const node = document.activeElement;
          if (!node) return 'NONE';
          return [node.tagName, node.getAttribute('aria-label') ?? '', node.textContent ?? '']
            .join('|').replace(/\\s+/g, ' ').trim();
        })()`,
      });
      focusSequence.push(result.result.value);
    }

    const meaningful = focusSequence.filter((value) =>
      value && value !== 'BODY||' && value !== 'NONE');
    const unique = new Set(meaningful);
    const stuck = meaningful.some((value, index) =>
      index > 0 && value === meaningful[index - 1]);
    if (unique.size < testCase.minimumUnique || stuck) {
      throw new Error(
        `${testCase.state} focus trap: unique=${unique.size}, sequence=${meaningful.join(' -> ')}`,
      );
    }
    console.log(`PASS ${testCase.state}: ${unique.size} unique browser focus targets; no consecutive trap`);
  } finally {
    socket.close();
    await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
  }
}

console.log('PASS: browser/CDP keyboard traversal has no focus traps');
