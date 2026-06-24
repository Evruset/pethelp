import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

type Evidence = {
  scenario: string;
  correlationId: string;
  result: 'PASS' | 'FAIL' | 'NOT_RUN';
  observations: string[];
  exchanges: Array<{ label: string; status: number | 'NETWORK_ERROR'; body: unknown }>;
};

type AlternativeFixture = {
  holdId: string;
  alternativeSlotId: string;
};

type ExpiredPaymentFixture = {
  holdId: string;
  paymentIntentId: string;
  idempotencyKey: string;
  providerEventId: string;
  providerPaymentId: string;
  rawWebhook: string;
  signature: string;
};

const enabled = process.env.SANDBOX_CERT_ENABLED === 'true';
const reportPath = path.resolve(process.cwd(), 'artifacts/certification/SANDBOX_CERTIFICATION_REPORT.md');
const evidence: Evidence[] = [];
const suite = enabled ? describe : describe.skip;

class SandboxHttp {
  readonly client: AxiosInstance;
  constructor(private readonly name: string, baseURL: string, private readonly trace: Evidence) {
    this.client = axios.create({ baseURL: baseURL.replace(/\/$/, ''), timeout: 10_000, validateStatus: () => true });
  }

  async request<T>(label: string, method: 'get' | 'post', url: string, data?: unknown, headers?: Record<string, string>): Promise<AxiosResponse<T>> {
    try {
      const response = await this.client.request<T>({ method, url, data, headers });
      this.trace.exchanges.push({ label: `${this.name}:${label}`, status: response.status, body: redact(response.data) });
      return response;
    } catch (error) {
      this.trace.exchanges.push({ label: `${this.name}:${label}`, status: 'NETWORK_ERROR', body: redact(axios.isAxiosError(error) ? error.toJSON() : String(error)) });
      throw error;
    }
  }
}

suite('External Sandbox Certification Suite', () => {
  const configuration = requiredConfiguration();

  afterAll(async () => {
    if (!enabled) {
      evidence.push({
        scenario: 'External sandbox certification',
        correlationId: 'not-run',
        result: 'NOT_RUN',
        observations: ['Set SANDBOX_CERT_ENABLED=true and provide the documented sandbox variables to run against external providers.'],
        exchanges: [],
      });
    }
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, renderReport(evidence), 'utf8');
  });

  it('keeps a locally held alternative slot in MIS_RECONCILIATION_PENDING after a 4000ms provider timeout', async () => {
    const trace = createEvidence('MIS timeout after accept');
    const mis = new SandboxHttp('mis', configuration.misApiUrl, trace);
    const vethelp = new SandboxHttp('vethelp', configuration.vethelpApiUrl, trace);

    try {
      const setup = await mis.request('configure timeout-after-accept', 'post', '/__certification/scenarios/timeout-after-accept', {
        delayMs: 4000,
        correlationId: trace.correlationId,
      }, certificationHeaders(configuration));
      expect(setup.status).toBeGreaterThanOrEqual(200);
      expect(setup.status).toBeLessThan(300);

      const fixture = await vethelp.request<AlternativeFixture>('create alternative-slot fixture', 'post', '/v1/internal/certification/fixtures/alternative-slot', {
        correlationId: trace.correlationId,
      }, certificationHeaders(configuration));
      expect(fixture.status).toBe(201);
      expect(fixture.data.holdId).toBeTruthy();
      expect(fixture.data.alternativeSlotId).toBeTruthy();

      const accept = await vethelp.request('accept alternative slot', 'post', `/v1/booking-holds/${fixture.data.holdId}/alternative-slot/accept`, {
        alternativeSlotId: fixture.data.alternativeSlotId,
      }, ownerHeaders(configuration, trace.correlationId));
      expect([200, 202]).toContain(accept.status);

      const hold = await poll(async () => {
        const response = await vethelp.request<{ state: string }>('read hold state', 'get', `/v1/booking-holds/${fixture.data.holdId}`, undefined, ownerHeaders(configuration, trace.correlationId));
        return response.data;
      }, (value) => value.state === 'MIS_RECONCILIATION_PENDING', 20_000);

      expect(hold.state).toBe('MIS_RECONCILIATION_PENDING');
      trace.observations.push('Hold stayed protected locally after provider timeout; no local release was observed.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL';
      trace.observations.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  });

  it('fences a late authorized-payment webhook and verifies provider void evidence', async () => {
    const trace = createEvidence('Late webhook fencing');
    const acquiring = new SandboxHttp('acquiring', configuration.acquiringApiUrl, trace);
    const vethelp = new SandboxHttp('vethelp', configuration.vethelpApiUrl, trace);

    try {
      const fixture = await vethelp.request<ExpiredPaymentFixture>('create expired-payment fixture', 'post', '/v1/internal/certification/fixtures/expired-payment-hold', {
        correlationId: trace.correlationId,
      }, certificationHeaders(configuration));
      expect(fixture.status).toBe(201);

      const response = await vethelp.request('deliver late authorized webhook', 'post', '/v1/payments/webhooks/authorized', fixture.data.rawWebhook, {
        'Content-Type': 'application/json',
        'X-Acquiring-Signature': fixture.data.signature,
        'X-Acquiring-Event-Id': fixture.data.providerEventId,
        'Idempotency-Key': fixture.data.idempotencyKey,
        'X-Correlation-ID': trace.correlationId,
      });
      expect(response.status).toBe(422);
      expect((response.data as { code?: string }).code).toBe('PAYMENT_FENCED_SLOT_EXPIRED');

      const voidEvidence = await poll(async () => {
        const result = await acquiring.request<{ voided?: boolean; merchantPaymentId?: string }>(
          'verify provider void',
          'get',
          `/__certification/payment-intents/${encodeURIComponent(fixture.data.providerPaymentId)}/void-evidence`,
          undefined,
          certificationHeaders(configuration),
        );
        return result.data;
      }, (value) => value.voided === true && value.merchantPaymentId === fixture.data.paymentIntentId, 20_000);

      expect(voidEvidence.voided).toBe(true);
      trace.observations.push('Late payment was fenced and acquiring sandbox confirmed void request.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL';
      trace.observations.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
});

function requiredConfiguration() {
  if (!enabled) return { vethelpApiUrl: '', misApiUrl: '', acquiringApiUrl: '', certificationToken: '', ownerJwt: '' };
  return {
    vethelpApiUrl: requireEnv('SANDBOX_VETHELP_API_URL'),
    misApiUrl: requireEnv('SANDBOX_MIS_API_URL'),
    acquiringApiUrl: requireEnv('SANDBOX_ACQUIRING_API_URL'),
    certificationToken: requireEnv('SANDBOX_CERTIFICATION_TOKEN'),
    ownerJwt: requireEnv('SANDBOX_OWNER_JWT'),
  };
}

function createEvidence(scenario: string): Evidence {
  const item: Evidence = { scenario, correlationId: randomUUID(), result: 'NOT_RUN', observations: [], exchanges: [] };
  evidence.push(item);
  return item;
}

function certificationHeaders(configuration: ReturnType<typeof requiredConfiguration>): Record<string, string> {
  return { Authorization: `Bearer ${configuration.certificationToken}` };
}

function ownerHeaders(configuration: ReturnType<typeof requiredConfiguration>, correlationId: string): Record<string, string> {
  return { Authorization: `Bearer ${configuration.ownerJwt}`, 'X-Correlation-ID': correlationId };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured for SANDBOX_CERT_ENABLED=true`);
  return value;
}

async function poll<T>(action: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await action();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Certification condition was not observed within ${timeoutMs}ms: ${JSON.stringify(redact(last))}`);
}

function redact(value: unknown): unknown {
  const raw = JSON.stringify(value);
  if (!raw) return value;
  return JSON.parse(raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/("(?:signature|token|authorization)"\s*:\s*")[^"]+/gi, '$1[REDACTED]'));
}

function renderReport(items: Evidence[]): string {
  const rows = items.map((item) => `| ${item.scenario} | ${item.result} | \`${item.correlationId}\` | ${item.observations.join('<br>') || '-'} |`).join('\n');
  const details = items.map((item) => [
    `## ${item.scenario}`,
    `Correlation ID: \`${item.correlationId}\``,
    '',
    '```json',
    JSON.stringify(item.exchanges, null, 2),
    '```',
  ].join('\n')).join('\n\n');
  return [
    '# VetHelp External Sandbox Certification Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Scenario | Result | Correlation ID | Evidence |',
    '|---|---|---|---|',
    rows,
    '',
    details,
    '',
  ].join('\n');
}
