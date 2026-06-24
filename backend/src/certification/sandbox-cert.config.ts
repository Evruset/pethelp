import { URL } from 'node:url';

export interface SandboxCertificationConfig {
  vethelpUrl: URL;
  certificationToken: string;
  ownerJwt: string;
  misUrl: URL;
  misAuthToken: string;
  acquiringUrl: URL;
  acquiringSignSecret: string;
  allowedHosts: Set<string>;
  fixtureApiEnabled: true;
}

/**
 * Deliberately refuses every non-sandbox execution. This suite drives real HTTP
 * test endpoints and must never create fixtures in a developer DB or a production
 * provider account.
 */
export function loadSandboxCertificationConfig(env: NodeJS.ProcessEnv = process.env): SandboxCertificationConfig {
  if (env.NODE_ENV !== 'sandbox-cert') {
    throw new Error('External certification is allowed only with NODE_ENV=sandbox-cert');
  }
  if (env.SANDBOX_CERT_ENABLED !== 'true') {
    throw new Error('SANDBOX_CERT_ENABLED=true is required for external certification');
  }
  if (env.SANDBOX_FIXTURES_ENABLED !== 'true') {
    throw new Error('SANDBOX_FIXTURES_ENABLED=true is required before creating certification fixtures');
  }

  const environmentId = required(env, 'SANDBOX_ENVIRONMENT_ID');
  if (!/(sandbox|test|nonprod)/i.test(environmentId) || /(prod|production|live)/i.test(environmentId)) {
    throw new Error('SANDBOX_ENVIRONMENT_ID must identify a non-production sandbox');
  }

  const allowedHosts = new Set(required(env, 'SANDBOX_ALLOWED_HOSTS').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (allowedHosts.size === 0) throw new Error('SANDBOX_ALLOWED_HOSTS must contain every approved sandbox host');

  rejectLocalDatabase(env.DATABASE_URL);

  const vethelpUrl = approvedUrl(required(env, 'SANDBOX_VETHELP_URL'), 'SANDBOX_VETHELP_URL', allowedHosts, env);
  const misUrl = approvedUrl(required(env, 'SANDBOX_MIS_URL'), 'SANDBOX_MIS_URL', allowedHosts, env);
  const acquiringUrl = approvedUrl(required(env, 'SANDBOX_ACQUIRING_URL'), 'SANDBOX_ACQUIRING_URL', allowedHosts, env);

  return {
    vethelpUrl,
    certificationToken: required(env, 'SANDBOX_CERTIFICATION_TOKEN'),
    ownerJwt: required(env, 'SANDBOX_OWNER_JWT'),
    misUrl,
    misAuthToken: required(env, 'SANDBOX_MIS_AUTH_TOKEN'),
    acquiringUrl,
    acquiringSignSecret: required(env, 'SANDBOX_ACQUIRING_SIGN_SECRET'),
    allowedHosts,
    fixtureApiEnabled: true,
  };
}

function approvedUrl(raw: string, variable: string, allowedHosts: Set<string>, env: NodeJS.ProcessEnv): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variable} must be an absolute URL`);
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' && env.SANDBOX_ALLOW_HTTP !== 'true') {
    throw new Error(`${variable} must use HTTPS; SANDBOX_ALLOW_HTTP=true is required only for an explicitly isolated test network`);
  }
  if (isLoopbackOrLocal(host)) {
    throw new Error(`${variable} must not target localhost or a local fixture environment`);
  }
  if (!allowedHosts.has(host)) {
    throw new Error(`${variable} host ${host} is not listed in SANDBOX_ALLOWED_HOSTS`);
  }
  if (/(^|[.-])(prod|production|live)([.-]|$)/i.test(host)) {
    throw new Error(`${variable} resolves to a production-looking host and is rejected`);
  }
  return url;
}

function rejectLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) return;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is invalid; do not run external certification against an unknown database');
  }
  if (isLoopbackOrLocal(url.hostname)) {
    throw new Error('External certification refuses a local DATABASE_URL; sandbox fixtures must target the isolated remote environment only');
  }
}

function isLoopbackOrLocal(host: string): boolean {
  return host === 'localhost'
    || host === '::1'
    || host === '127.0.0.1'
    || host === '0.0.0.0'
    || host.endsWith('.local');
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for external sandbox certification`);
  return value;
}
