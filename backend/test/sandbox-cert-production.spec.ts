import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { createHmac, randomUUID } from 'node:crypto';
import { loadSandboxCertificationConfig, SandboxCertificationConfig } from '../src/certification/sandbox-cert.config';
import { redactEvidence, redactUrl, ScenarioEvidence, writeSandboxEvidence } from '../src/certification/sandbox-cert.evidence';

type MisTimeoutFixture = { holdId: string };
type SlotInvariant = { state: string; slot: { heldCount: number; activeHoldCount: number; capacity: number } };
type ExpiredPaymentFixture = { paymentIntentId: string; idempotencyKey: string; providerEventId: string; providerPaymentId: string; rawWebhook: string };
type LedgerEvidence = { entries?: Array<{ entryType?: string }> };

const externalRun = process.env.NODE_ENV === 'sandbox-cert' && process.env.SANDBOX_CERT_ENABLED === 'true';
const suite = externalRun ? describe : describe.skip;
const records: ScenarioEvidence[] = [];

class SandboxHttp {
  readonly client: AxiosInstance;

  constructor(private readonly system: string, baseURL: URL, private readonly evidence: ScenarioEvidence) {
    this.client = axios.create({ baseURL: baseURL.toString().replace(/\/$/, ''), timeout: 12_000, validateStatus: () => true });
  }

  async call<T>(label: string, method: 'get' | 'post', url: string, data?: unknown, headers?: Record<string, string>): Promise<AxiosResponse<T>> {
    const request = { method, url: redactUrl(`${this.client.defaults.baseURL}${url}`), body: redactEvidence(data), headers: redactEvidence(headers) };
    try {
      const response = await this.client.request<T>({ method, url, data, headers });
      this.evidence.exchanges.push({ label: `${this.system}:${label}`, method, url: request.url, status: response.status, request, response: redactEvidence(response.data), recordedAt: new Date().toISOString() });
      return response;
    } catch (error) {
      this.evidence.exchanges.push({ label: `${this.system}:${label}`, method, url: request.url, status: 'NETWORK_ERROR', request, response: redactEvidence(axios.isAxiosError(error) ? error.toJSON() : String(error)), recordedAt: new Date().toISOString() });
      throw error;
    }
  }
}

suite('External Sandbox Certification Suite', () => {
  let config: SandboxCertificationConfig;

  beforeAll(() => { config = loadSandboxCertificationConfig(); });
  afterAll(async () => { await writeSandboxEvidence(records); });

  it('MIS timeout keeps hold and slot counter in reconciliation pending', async () => {
    const trace = createEvidence('MIS Timeout After Accept');
    const mis = () => new SandboxHttp('mis', config.misUrl, trace);
    const vethelp = () => new SandboxHttp('vethelp', config.vethelpUrl, trace);
    try {
      const control = await mis().call('configure timeout', 'post', '/__certification/scenarios/timeout-after-accept', { delayMs: 4500, correlationId: trace.correlationId }, misHeaders(config, trace.correlationId));
      expect(control.status).toBeGreaterThanOrEqual(200);
      expect(control.status).toBeLessThan(300);

      const fixture = await vethelp().call<MisTimeoutFixture>('prepare reservation', 'post', '/v1/internal/sandbox-fixtures/prepare-mis-timeout', { correlationId: trace.correlationId }, fixtureHeaders(config));
      expect(fixture.status).toBe(201);
      const invariant = await poll(
        async () => (await vethelp().call<SlotInvariant>('read invariant', 'get', `/v1/internal/sandbox-fixtures/booking-holds/${fixture.data.holdId}/slot-invariant`, undefined, fixtureHeaders(config))).data,
        (value) => value.state === 'MIS_RECONCILIATION_PENDING' && value.slot.heldCount > 0 && value.slot.heldCount === value.slot.activeHoldCount,
        45_000,
      );
      expect(invariant.slot.heldCount).toBeLessThanOrEqual(invariant.slot.capacity);

      const evidence = await vethelp().call('collect MIS evidence', 'post', '/v1/internal/sandbox-fixtures/collect-mis-timeout', {
        correlationId: trace.correlationId, holdId: fixture.data.holdId, rawHttpDump: JSON.stringify(trace.exchanges),
      }, fixtureHeaders(config));
      expect(evidence.status).toBe(200);
      trace.observations.push('MIS timeout exceeded 4000ms; production dispatcher retained local capacity in reconciliation.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL'; trace.observations.push(errorMessage(error)); throw error;
    }
  });

  it('Late Webhook Fencing voids expired payment and writes FENCED ledger evidence', async () => {
    const trace = createEvidence('Late Webhook Fencing');
    const vethelp = () => new SandboxHttp('vethelp', config.vethelpUrl, trace);
    const acquiring = () => new SandboxHttp('acquiring', config.acquiringUrl, trace);
    try {
      const fixture = await vethelp().call<ExpiredPaymentFixture>('prepare expired payment', 'post', '/v1/internal/sandbox-fixtures/prepare-late-payment', { correlationId: trace.correlationId }, fixtureHeaders(config));
      expect(fixture.status).toBe(201);
      const signature = createHmac('sha256', config.acquiringSignSecret).update(fixture.data.rawWebhook).digest('hex');
      const webhook = await vethelp().call('deliver late authorization', 'post', '/v1/payments/webhooks/authorized', fixture.data.rawWebhook, {
        'Content-Type': 'application/json', 'X-Acquiring-Signature': signature,
        'X-Acquiring-Event-Id': fixture.data.providerEventId,
        'Idempotency-Key': fixture.data.idempotencyKey, 'X-Correlation-ID': trace.correlationId,
      });
      expect(webhook.status).toBe(422);
      expect((webhook.data as { code?: string }).code).toBe('PAYMENT_FENCED_SLOT_EXPIRED');

      const ledger = await poll(
        async () => (await vethelp().call<LedgerEvidence>('read ledger', 'get', `/v1/internal/sandbox-fixtures/payment-intents/${fixture.data.paymentIntentId}/ledger`, undefined, fixtureHeaders(config))).data,
        (value) => Boolean(value.entries?.some((entry) => entry.entryType === 'FENCED')),
        25_000,
      );
      expect(ledger.entries?.some((entry) => entry.entryType === 'FENCED')).toBe(true);
      const voidEvidence = await poll(
        async () => (await acquiring().call<{ voided?: boolean; merchantPaymentId?: string }>('verify void', 'get', `/__certification/payment-intents/${encodeURIComponent(fixture.data.providerPaymentId)}/void-evidence`, undefined, acquiringHeaders(config, trace.correlationId))).data,
        (value) => value.voided === true && value.merchantPaymentId === fixture.data.paymentIntentId,
        25_000,
      );
      expect(voidEvidence.voided).toBe(true);
      const evidence = await vethelp().call('collect payment evidence', 'post', '/v1/internal/sandbox-fixtures/collect-late-payment', {
        correlationId: trace.correlationId, paymentIntentId: fixture.data.paymentIntentId, rawHttpDump: JSON.stringify(trace.exchanges),
      }, fixtureHeaders(config));
      expect(evidence.status).toBe(200);
      trace.observations.push('Late authorization was fenced, ledger FENCED was written, acquiring void was confirmed.');
      trace.result = 'PASS';
    } catch (error) {
      trace.result = 'FAIL'; trace.observations.push(errorMessage(error)); throw error;
    }
  });
});

function createEvidence(scenario: string): ScenarioEvidence {
  const evidence: ScenarioEvidence = { scenario, correlationId: randomUUID(), result: 'NOT_RUN', observations: [], exchanges: [] };
  records.push(evidence); return evidence;
}
function fixtureHeaders(config: SandboxCertificationConfig): Record<string, string> { return { Authorization: `Bearer ${config.certificationToken}` }; }
function misHeaders(config: SandboxCertificationConfig, correlationId: string): Record<string, string> { return { Authorization: `Bearer ${config.misAuthToken}`, 'X-Correlation-ID': correlationId }; }
function acquiringHeaders(config: SandboxCertificationConfig, correlationId: string): Record<string, string> { return { Authorization: `Bearer ${config.certificationToken}`, 'X-Correlation-ID': correlationId }; }
async function poll<T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs; let last: T | undefined;
  while (Date.now() < deadline) { last = await read(); if (predicate(last)) return last; await new Promise((resolve) => setTimeout(resolve, 500)); }
  throw new Error(`Certification condition not observed in ${timeoutMs}ms: ${JSON.stringify(redactEvidence(last))}`);
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
