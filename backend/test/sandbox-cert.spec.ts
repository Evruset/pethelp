import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

type Result = 'PASS' | 'FAIL' | 'NOT_RUN';
type Evidence = { scenario: string; correlationId: string; result: Result; observations: string[]; exchanges: Array<{ label: string; status: number | 'NETWORK_ERROR'; body: unknown }> };
type AlternativeFixture = { holdId: string; alternativeSlotId: string };
type ExpiredPaymentFixture = { holdId: string; paymentIntentId: string; idempotencyKey: string; providerEventId: string; providerPaymentId: string; rawWebhook: string; signature: string };
type LedgerEvidence = { entries?: Array<{ entryType?: string }> };

const enabled = process.env.SANDBOX_CERT_ENABLED === 'true';
const reportPath = path.resolve(process.cwd(), 'artifacts/certification/SANDBOX_CERTIFICATION_REPORT.md');
const records: Evidence[] = [];
const suite = enabled ? describe : describe.skip;

class Http {
  readonly client: AxiosInstance;
  constructor(private readonly system: string, url: string, private readonly evidence: Evidence) {
    this.client = axios.create({ baseURL: url.replace(/\/$/, ''), timeout: 10_000, validateStatus: () => true });
  }
  async call<T>(label: string, method: 'get' | 'post', url: string, data?: unknown, headers?: Record<string, string>): Promise<AxiosResponse<T>> {
    try {
      const response = await this.client.request<T>({ method, url, data, headers });
      this.evidence.exchanges.push({ label: `${this.system}:${label}`, status: response.status, body: redact(response.data) });
      return response;
    } catch (error) {
      this.evidence.exchanges.push({ label: `${this.system}:${label}`, status: 'NETWORK_ERROR', body: redact(axios.isAxiosError(error) ? error.toJSON() : String(error)) });
      throw error;
    }
  }
}

suite('External Sandbox Certification Suite', () => {
  const config = configuration();

  afterAll(async () => {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, report(records), 'utf8');
  });

  it('keeps a locally held alternative slot in MIS_RECONCILIATION_PENDING after timeout after accept', async () => {
    const trace = evidence('MIS timeout after accept');
    const mis = new Http('mis', config.misApiUrl, trace);
    const vethelp = new Http('vethelp', config.vethelpApiUrl, trace);
    try {
      const control = await mis.call('configure timeout', 'post', '/__certification/scenarios/timeout-after-accept', { delayMs: 4000, correlationId: trace.correlationId }, certHeaders(config));
      expect(control.status).toBeGreaterThanOrEqual(200);
      expect(control.status).toBeLessThan(300);
      const fixture = await vethelp.call<AlternativeFixture>('create fixture', 'post', '/v1/internal/certification/fixtures/alternative-slot', { correlationId: trace.correlationId }, certHeaders(config));
      expect(fixture.status).toBe(201);
      const accepted = await vethelp.call('accept alternative', 'post', `/v1/booking-holds/${fixture.data.holdId}/alternative-slot/accept`, { alternativeSlotId: fixture.data.alternativeSlotId }, ownerHeaders(config, trace.correlationId));
      expect([200, 202]).toContain(accepted.status);
      const hold = await poll(async () => (await vethelp.call<{ state: string }>('read hold', 'get', `/v1/booking-holds/${fixture.data.holdId}`, undefined, ownerHeaders(config, trace.correlationId))).data, (value) => value.state === 'MIS_RECONCILIATION_PENDING', 20_000);
      expect(hold.state).toBe('MIS_RECONCILIATION_PENDING');
      trace.observations.push('Provider timeout left local capacity protected in MIS_RECONCILIATION_PENDING.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL'; trace.observations.push(message(error)); throw error;
    }
  });

  it('fences late webhook, records FENCED ledger evidence and verifies acquiring void', async () => {
    const trace = evidence('Late webhook fencing');
    const vethelp = new Http('vethelp', config.vethelpApiUrl, trace);
    const acquiring = new Http('acquiring', config.acquiringApiUrl, trace);
    try {
      const fixture = await vethelp.call<ExpiredPaymentFixture>('create expired fixture', 'post', '/v1/internal/certification/fixtures/expired-payment-hold', { correlationId: trace.correlationId }, certHeaders(config));
      expect(fixture.status).toBe(201);
      const webhook = await vethelp.call('deliver late authorization', 'post', '/v1/payments/webhooks/authorized', fixture.data.rawWebhook, {
        'Content-Type': 'application/json',
        'X-Acquiring-Signature': fixture.data.signature,
        'X-Acquiring-Event-Id': fixture.data.providerEventId,
        'Idempotency-Key': fixture.data.idempotencyKey,
        'X-Correlation-ID': trace.correlationId,
      });
      expect(webhook.status).toBe(422);
      expect((webhook.data as { code?: string }).code).toBe('PAYMENT_FENCED_SLOT_EXPIRED');
      const ledger = await poll(async () => (await vethelp.call<LedgerEvidence>('read ledger evidence', 'get', `/v1/internal/certification/payment-intents/${fixture.data.paymentIntentId}/ledger`, undefined, certHeaders(config))).data, (value) => Boolean(value.entries?.some((entry) => entry.entryType === 'FENCED')), 20_000);
      expect(ledger.entries?.some((entry) => entry.entryType === 'FENCED')).toBe(true);
      const voidEvidence = await poll(async () => (await acquiring.call<{ voided?: boolean; merchantPaymentId?: string }>('read void evidence', 'get', `/__certification/payment-intents/${encodeURIComponent(fixture.data.providerPaymentId)}/void-evidence`, undefined, certHeaders(config))).data, (value) => value.voided === true && value.merchantPaymentId === fixture.data.paymentIntentId, 20_000);
      expect(voidEvidence.voided).toBe(true);
      trace.observations.push('Late authorization was fenced, FENCED ledger evidence was observed, and acquiring void was confirmed.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL'; trace.observations.push(message(error)); throw error;
    }
  });
});

function configuration() {
  if (!enabled) return { vethelpApiUrl: '', misApiUrl: '', acquiringApiUrl: '', token: '', ownerJwt: '' };
  return { vethelpApiUrl: required('SANDBOX_VETHELP_API_URL'), misApiUrl: required('SANDBOX_MIS_API_URL'), acquiringApiUrl: required('SANDBOX_ACQUIRING_API_URL'), token: required('SANDBOX_CERTIFICATION_TOKEN'), ownerJwt: required('SANDBOX_OWNER_JWT') };
}
function evidence(scenario: string): Evidence { const item = { scenario, correlationId: randomUUID(), result: 'NOT_RUN' as Result, observations: [], exchanges: [] }; records.push(item); return item; }
function certHeaders(config: ReturnType<typeof configuration>): Record<string, string> { return { Authorization: `Bearer ${config.token}` }; }
function ownerHeaders(config: ReturnType<typeof configuration>, correlationId: string): Record<string, string> { return { Authorization: `Bearer ${config.ownerJwt}`, 'X-Correlation-ID': correlationId }; }
function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} must be configured when SANDBOX_CERT_ENABLED=true`); return value; }
async function poll<T>(action: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs: number): Promise<T> { const deadline = Date.now() + timeoutMs; let last: T | undefined; while (Date.now() < deadline) { last = await action(); if (predicate(last)) return last; await new Promise((resolve) => setTimeout(resolve, 500)); } throw new Error(`Condition not observed within ${timeoutMs}ms: ${JSON.stringify(redact(last))}`); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function redact(value: unknown): unknown { const raw = JSON.stringify(value); if (!raw) return value; return JSON.parse(raw.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]').replace(/("(?:signature|token|authorization)"\s*:\s*")[^"]+/gi, '$1[REDACTED]')); }
function report(items: Evidence[]): string { const rows = items.map((item) => `| ${item.scenario} | ${item.result} | \`${item.correlationId}\` | ${item.observations.join('<br>') || '-'} |`).join('\n'); const details = items.map((item) => `## ${item.scenario}\nCorrelation ID: \`${item.correlationId}\`\n\n\`\`\`json\n${JSON.stringify(item.exchanges, null, 2)}\n\`\`\``).join('\n\n'); return `# VetHelp External Sandbox Certification Report\n\nGenerated: ${new Date().toISOString()}\n\n| Scenario | Result | Correlation ID | Evidence |\n|---|---|---|---|\n${rows}\n\n${details}\n`; }
