const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const launcher = path.join(root, 'start-vethelp.sh');
const fixtureServer = path.join(__dirname, 'canonical-smoke-fixture.cjs');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vethelp-smoke.'));

function writeExecutable(target, content) {
  fs.writeFileSync(target, content, { mode: 0o700 });
}

function composeRows(health = 'healthy') {
  return ['postgres', 'backend', 'mock-mis', 'mock-acquiring', 'mock-cloud', 'livekit']
    .map((service) => JSON.stringify({
      ID: `id-${service}`,
      Service: service,
      State: 'running',
      Health: service === 'livekit' ? '' : (service === 'backend' ? health : 'healthy'),
      Publishers: service === 'livekit'
        ? [{ TargetPort: 7880, PublishedPort: 7880 }]
        : [],
    }))
    .join('\n');
}

async function startServer(scenario) {
  const child = spawn(process.execPath, [fixtureServer], {
    env: { ...process.env, SMOKE_FIXTURE_SCENARIO: scenario },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const port = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', (chunk) => resolve(Number(String(chunk).trim())));
  });
  return { child, port };
}

async function runSmoke(scenario, options = {}) {
  const current = path.join(fixtureRoot, `${scenario}-${Math.random().toString(16).slice(2)}`);
  const bin = path.join(current, 'bin');
  const state = path.join(current, 'state');
  fs.mkdirSync(path.join(state, 'rich-demo', 'bootstrap-codes'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(state, 'pids'), { recursive: true, mode: 0o700 });
  fs.chmodSync(state, 0o700);
  fs.chmodSync(path.join(state, 'rich-demo'), 0o700);
  if (options.badRootMode) fs.chmodSync(state, 0o755);
  fs.writeFileSync(path.join(state, 'seed.json'), '{}\n', { mode: 0o600 });
  if (options.secret) {
    fs.writeFileSync(path.join(state, 'secret.txt'), 'Bearer abc.def_ghi\n', { mode: 0o600 });
  }
  fs.mkdirSync(bin, { mode: 0o700 });
  const rowsPath = path.join(current, 'compose.jsonl');
  fs.writeFileSync(rowsPath, composeRows(options.unhealthy ? 'unhealthy' : 'healthy'));
  writeExecutable(path.join(bin, 'docker'), `#!/usr/bin/env bash
if [[ "$1" == info ]]; then printf '27.3.1\\n'; exit 0; fi
if [[ "$1" == inspect ]]; then
  [[ "\${SMOKE_RESTART:-0}" == 1 ]] && printf '1\\n' || printf '0\\n'
  exit 0
fi
if [[ "$1" == compose ]]; then cat "$SMOKE_COMPOSE_ROWS"; exit 0; fi
exit 1
`);
  writeExecutable(path.join(bin, 'lsof'), `#!/usr/bin/env bash
printf '%s' "\${SMOKE_LISTENERS:-}"
`);

  const server = await startServer(options.httpScenario || 'healthy');
  const url = `http://127.0.0.1:${server.port}`;
  const before = fs.statSync(path.join(state, 'seed.json')).mtimeMs;
  const result = spawnSync(launcher, ['--mode', 'bounded-test', 'smoke'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      VETHELP_TEST_STATE_ROOT: state,
      VETHELP_PROJECT: options.project || 'vethelp-alpha',
      VETHELP_BACKEND_URL: url,
      VETHELP_MOCK_MIS_URL: url,
      VETHELP_MOCK_ACQUIRING_URL: url,
      VETHELP_MOCK_CLOUD_URL: url,
      SMOKE_COMPOSE_ROWS: rowsPath,
      SMOKE_RESTART: options.restart ? '1' : '0',
      SMOKE_LISTENERS: options.listeners || '',
    },
    timeout: 15000,
  });
  server.child.kill('SIGTERM');
  const report = JSON.parse(result.stdout.trim());
  assert.equal(fs.statSync(path.join(state, 'seed.json')).mtimeMs, before);
  return { result, report };
}

test.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test('healthy smoke is machine-readable and read-only', async () => {
  const { result, report } = await runSmoke('healthy');
  assert.equal(result.status, 0);
  assert.equal(report.status, 'PASS');
  assert.equal(report.command, 'smoke');
  assert.equal(report.mode, 'read-only');
  assert.deepEqual(report.violations, []);
  assert.equal(report.restartCounts.backend, 0);
});

for (const [name, options, violation] of [
  ['unhealthy', { unhealthy: true }, 'backend:not-healthy'],
  ['wrong-project', { project: 'foreign-project' }, 'project:unexpected-foreign-project'],
  ['restart', { restart: true }, 'backend:restart-count-1'],
  ['second-portal', { listeners: '101\n102\n' }, 'portal:multiple-listeners-2'],
  ['secret', { secret: true }, 'runtime-state:sensitiveMatches-1'],
  ['root-mode', { badRootMode: true }, 'runtime-state:directoryModeViolations-1'],
  ['malformed', { httpScenario: 'malformed' }, 'backend:malformed-json'],
  ['timeout', { httpScenario: 'timeout' }, 'backend:timeout'],
]) {
  test(`smoke reports ${name}`, async () => {
    const { result, report } = await runSmoke(name, options);
    assert.equal(result.status, 1);
    assert.equal(report.status, 'FAIL');
    assert.ok(report.violations.includes(violation), report.violations.join(','));
  });
}
