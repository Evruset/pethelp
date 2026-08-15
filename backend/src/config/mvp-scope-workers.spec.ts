process.env.JWT_SECRET ??= 'mvp-scope-worker-test-secret-at-least-32-bytes';
process.env.JWT_ISSUER ??= 'mvp-scope-worker-test';
process.env.JWT_AUDIENCE ??= 'mvp-scope-worker-test';
process.env.WORKER_SERVICE_TOKEN ??= 'mvp-scope-worker-token';
process.env.MVP_SCOPE_PROFILE = 'PILOT_V1';
process.env.WORKERS_ENABLED = 'true';

const { MisOutboxRelayWorker } = require('../modules/mis-integration/outbox-relay.worker') as typeof import('../modules/mis-integration/outbox-relay.worker');
const { MisReconciliationSweeperWorker } = require('../modules/mis-integration/mis-reconciliation-sweeper.worker') as typeof import('../modules/mis-integration/mis-reconciliation-sweeper.worker');
const { PaymentOutboxRelayWorker } = require('../modules/payments/payment-outbox-relay.worker') as typeof import('../modules/payments/payment-outbox-relay.worker');
const { PaymentReconciliationWorker } = require('../modules/payments/payment-reconciliation.worker') as typeof import('../modules/payments/payment-reconciliation.worker');
const { TelemedSessionStartWorker } = require('../modules/telemed/telemed-session-start.worker') as typeof import('../modules/telemed/telemed-session-start.worker');
const { TelemedSlaWorker } = require('../modules/telemed/telemed-sla.worker') as typeof import('../modules/telemed/telemed-sla.worker');
const { InsuranceCoverageWorker } = require('../modules/insurance/insurance-coverage-worker') as typeof import('../modules/insurance/insurance-coverage-worker');

describe('PILOT_V1 disabled external workers', () => {
  it.each([
    ['MIS relay', MisOutboxRelayWorker, 'relay'],
    ['MIS reconciliation', MisReconciliationSweeperWorker, 'reconcile'],
    ['payment relay', PaymentOutboxRelayWorker, 'relay'],
    ['payment reconciliation', PaymentReconciliationWorker, 'reconcile'],
    ['telemedicine session relay', TelemedSessionStartWorker, 'relayConfirmedSessions'],
    ['telemedicine SLA', TelemedSlaWorker, 'enforceExpiredSessions'],
    ['insurance coverage relay', InsuranceCoverageWorker, 'relayCoverageRequests'],
  ])('%s exits before database claim or provider access', async (_name, Worker, method) => {
    const worker = Reflect.construct(Worker, []) as Record<string, () => Promise<void>>;
    await expect(worker[method]()).resolves.toBeUndefined();
  });
});
