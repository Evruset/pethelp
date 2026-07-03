#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('../..', import.meta.url).pathname);
const appDir = `${rootDir}/apps/owner_mobile`;
const device = process.env.OWNER_DEVICE ?? 'chrome';
const flutterBin =
  process.env.FLUTTER_BIN ??
  (existsSync(`${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`)
    ? `${process.env.HOME}/develop/flutter-3.27.4/bin/flutter`
    : 'flutter');
const chromedriverPort = Number(process.env.CHROMEDRIVER_PORT ?? 4444);

function fail(message) {
  console.error(`[owner-integration-test] ${message}`);
  process.exit(1);
}

function commandExists(command) {
  return spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore',
  }).status === 0;
}

function findChrome() {
  if (process.env.CHROME_EXECUTABLE && existsSync(process.env.CHROME_EXECUTABLE)) {
    return process.env.CHROME_EXECUTABLE;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const fromPath = spawnSync('sh', ['-lc', 'command -v google-chrome || command -v chromium || command -v chromium-browser || true'], {
    encoding: 'utf8',
  }).stdout.trim();
  if (fromPath) return fromPath;
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function findChromedriver() {
  if (process.env.CHROMEDRIVER_BIN && existsSync(process.env.CHROMEDRIVER_BIN)) {
    return process.env.CHROMEDRIVER_BIN;
  }
  const fromPath = spawnSync('sh', ['-lc', 'command -v chromedriver || true'], {
    encoding: 'utf8',
  }).stdout.trim();
  return fromPath || null;
}

async function canReachChromedriver() {
  try {
    const response = await fetch(`http://127.0.0.1:${chromedriverPort}/status`);
    return response.ok;
  } catch {
    return false;
  }
}

function startChromedriver(chromedriverBin) {
  const child = spawn(chromedriverBin, [`--port=${chromedriverPort}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[chromedriver] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[chromedriver] ${chunk}`));
  return child;
}

async function waitForChromedriver() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await canReachChromedriver()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  fail(`ChromeDriver did not become reachable at http://127.0.0.1:${chromedriverPort}/status.`);
}

function runFlutterDrive() {
  const result = spawnSync(flutterBin, [
    'drive',
    '-d',
    device,
    '--driver=test_driver/integration_test.dart',
    '--target=integration_test/owner_booking_insurance_smoke_test.dart',
  ], {
    cwd: appDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CHROMEDRIVER_PORT: String(chromedriverPort),
    },
  });
  return result.status ?? 1;
}

async function main() {
  if (!existsSync(flutterBin) && !commandExists(flutterBin)) {
    fail(`Flutter binary is not available: ${flutterBin}. Set FLUTTER_BIN=/path/to/flutter.`);
  }

  let chromedriver;
  if (device === 'chrome') {
    const chrome = findChrome();
    if (!chrome) {
      fail('Chrome/Chromium was not found. Install Chrome or set CHROME_EXECUTABLE.');
    }
    const chromedriverBin = findChromedriver();
    if (!chromedriverBin) {
      fail('ChromeDriver was not found. Install a compatible chromedriver or set CHROMEDRIVER_BIN.');
    }
    if (!(await canReachChromedriver())) {
      chromedriver = startChromedriver(chromedriverBin);
      await waitForChromedriver();
    }
  }

  try {
    const status = runFlutterDrive();
    process.exitCode = status;
  } finally {
    if (chromedriver) {
      chromedriver.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
