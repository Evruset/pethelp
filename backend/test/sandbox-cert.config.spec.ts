import { loadSandboxCertificationConfig } from '../src/certification/sandbox-cert.config';

const valid = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'sandbox-cert',
  SANDBOX_CERT_ENABLED: 'true',
  SANDBOX_FIXTURES_ENABLED: 'true',
  SANDBOX_ENVIRONMENT_ID: 'alpha-sandbox-01',
  SANDBOX_ALLOWED_HOSTS: 'vethelp-sandbox.test,mis-sandbox.test,acquiring-sandbox.test',
  SANDBOX_VETHELP_URL: 'https://vethelp-sandbox.test',
  SANDBOX_MIS_URL: 'https://mis-sandbox.test',
  SANDBOX_ACQUIRING_URL: 'https://acquiring-sandbox.test',
  SANDBOX_CERTIFICATION_TOKEN: 'cert-token',
  SANDBOX_OWNER_JWT: 'owner-jwt',
  SANDBOX_MIS_AUTH_TOKEN: 'mis-token',
  SANDBOX_ACQUIRING_SIGN_SECRET: 'acquiring-secret',
});

describe('sandbox certification configuration guard', () => {
  it('accepts an allowlisted non-production sandbox only', () => {
    expect(loadSandboxCertificationConfig(valid()).misUrl.hostname).toBe('mis-sandbox.test');
  });

  it('rejects non-sandbox NODE_ENV before fixtures can run', () => {
    const env = valid();
    env.NODE_ENV = 'production';
    expect(() => loadSandboxCertificationConfig(env)).toThrow(/NODE_ENV=sandbox-cert/);
  });

  it('rejects production-looking provider targets', () => {
    const env = valid();
    env.SANDBOX_ALLOWED_HOSTS = 'vethelp-sandbox.test,mis-prod.test,acquiring-sandbox.test';
    env.SANDBOX_MIS_URL = 'https://mis-prod.test';
    expect(() => loadSandboxCertificationConfig(env)).toThrow(/production-looking host/);
  });

  it('rejects local fixture database URLs', () => {
    const env = valid();
    env.DATABASE_URL = 'postgres://vethelp:vethelp@127.0.0.1:5432/vethelp';
    expect(() => loadSandboxCertificationConfig(env)).toThrow(/local DATABASE_URL/);
  });
});
