#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const project = process.env.LOCAL_PROJECT ?? 'vethelp-alpha';
const composeFile = process.env.COMPOSE_FILE ?? 'docker-compose.local.yml';
const portalBaseUrl = (process.env.CLINIC_PORTAL_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const shouldOpen = process.argv.includes('--open') || process.env.OPEN === '1';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout?.trim() ?? '';
}

async function canFetch(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function parseJsonFromOutput(output) {
  const trimmed = output.trim();
  const start = trimmed.lastIndexOf('{');
  if (start < 0) throw new Error(`Cannot find JSON in command output:\n${output}`);
  return JSON.parse(trimmed.slice(start));
}

function composeArgs(...args) {
  return ['compose', '-p', project, '-f', composeFile, ...args];
}

async function main() {
  if (!(await canFetch('http://127.0.0.1:3000/v1/health'))) {
    throw new Error('Backend is not healthy on http://127.0.0.1:3000/v1/health. Run make local-up and make local-seed first.');
  }

  const seedOutput = run('docker', composeArgs(
    'exec',
    '-T',
    'backend',
    'npx',
    'ts-node',
    '/workspace/backend/scripts/seed-local-clinic-employee.ts',
  ), { capture: true });
  const seed = parseJsonFromOutput(seedOutput);
  const { clinicId, locationId, employeeId } = seed;
  if (!clinicId || !locationId) throw new Error(`Invalid seed-local-clinic-employee output:\n${seedOutput}`);

  const token = run('docker', composeArgs(
    'exec',
    '-T',
    '-e',
    `LOCAL_CLINIC_ID=${clinicId}`,
    '-e',
    `LOCAL_CLINIC_LOCATION_ID=${locationId}`,
    'backend',
    'node',
    '/workspace/dev/local/create-clinic-token.mjs',
  ), { capture: true });

  const queuePath = `/clinics/${clinicId}/locations/${locationId}/queue`;
  const queueUrl = `${portalBaseUrl}${queuePath}`;
  const sessionUrl = `${portalBaseUrl}/api/dev/local-session?${new URLSearchParams({ token })}`;
  const portalReachable = await canFetch(portalBaseUrl);

  console.log(JSON.stringify({
    employeeId,
    clinicId,
    locationId,
    queueUrl,
    sessionUrl,
    portalReachable,
    nextStep: portalReachable
      ? `Open sessionUrl; it sets vethelp_clinic_session and redirects to ${queuePath}.`
      : 'Start the portal first: cd apps/clinic-portal && npm run dev -- --port 3001',
  }, null, 2));

  if (shouldOpen) {
    if (!portalReachable) throw new Error('Clinic Portal is not reachable; start it before using --open.');
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', sessionUrl] : [sessionUrl];
    run(opener, args);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
