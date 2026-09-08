import type { HttpService } from '@nestjs/axios';
import { randomUUID } from 'node:crypto';
import { of } from 'rxjs';
import { AlertForwarderService } from '../src/observability/alert-forwarder.service';

describe('AlertForwarderService', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('forwards a critical JSON payload to Telegram with correlation context', async () => {
    process.env.ALERT_FORWARDER_ENABLED = 'true';
    process.env.ALERT_FORWARDER_CHANNEL = 'telegram';
    process.env.TELEGRAM_BOT_TOKEN = 'alpha-test-token';
    process.env.TELEGRAM_CHAT_ID = '-100123';

    const http = {
      post: jest.fn(() => of({ data: { ok: true } })),
    } as unknown as HttpService;
    const service = new AlertForwarderService(http);

    await service.forward({
      timestamp: '2026-06-23T10:00:00.000Z',
      level: 'error',
      context: 'PaymentReconciliationWorker',
      message: 'Payment fencing rejected a late provider callback',
      correlationId: '11111111-1111-4111-8111-111111111111',
      alert_type: 'PAYMENT_FENCING_TRIGGERED',
      paymentIntentId: randomUUID(),
      userId: 'must-not-be-forwarded',
      rawProviderPayload: { sensitive: true },
    });

    expect(http.post).toHaveBeenCalledTimes(1);
    const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, { text: string }];
    expect(body.text).toContain('PAYMENT_FENCING_TRIGGERED');
    expect(body.text).toContain('correlationId: 11111111-1111-4111-8111-111111111111');
    expect(body.text).toContain('paymentIntentId:');
    expect(body.text).not.toContain('must-not-be-forwarded');
    expect(body.text).not.toContain('rawProviderPayload');
  });

  it('re-sanitizes direct JSONL alerts and drops code-shaped secrets', async () => {
    process.env.ALERT_FORWARDER_ENABLED = 'true';
    process.env.ALERT_FORWARDER_CHANNEL = 'telegram';
    process.env.TELEGRAM_BOT_TOKEN = 'alpha-test-token';
    process.env.TELEGRAM_CHAT_ID = '-100123';
    const http = { post: jest.fn(() => of({ data: { ok: true } })) } as unknown as HttpService;
    const service = new AlertForwarderService(http);

    await service.forwardFromLine(JSON.stringify({
      alert_type: 'REFUND_FAILED', context: 'secret-access-token', message: 'sk_live_example',
      errorCode: 'secret-access-token', provider: 'sk_live_example', outcome: 'secret-access-token',
    }));

    const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, { text: string }];
    expect(body.text).toContain('REFUND_FAILED');
    expect(body.text).not.toContain('secret-access-token');
    expect(body.text).not.toContain('sk_live_example');
  });

  it('fails closed for accessor and proxy alert payloads', async () => {
    process.env.ALERT_FORWARDER_ENABLED = 'true';
    const http = { post: jest.fn(() => of({ data: { ok: true } })) } as unknown as HttpService;
    const service = new AlertForwarderService(http);
    const getter = jest.fn(() => 'REFUND_FAILED');
    const accessor = Object.defineProperties({}, {
      alert_type: { enumerable: true, get: getter },
      message: { enumerable: true, get: getter },
      context: { enumerable: true, get: getter },
      correlationId: { enumerable: true, get: getter },
    });

    await service.forward(accessor);
    await service.forward(new Proxy({}, { ownKeys: () => { throw new Error('secret-access-token'); } }));

    expect(getter).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('does not read inherited core telemetry getters', async () => {
    process.env.ALERT_FORWARDER_ENABLED = 'true';
    process.env.TELEGRAM_BOT_TOKEN = 'alpha-test-token';
    process.env.TELEGRAM_CHAT_ID = '-100123';
    const http = { post: jest.fn(() => of({ data: { ok: true } })) } as unknown as HttpService;
    const service = new AlertForwarderService(http);
    const getter = jest.fn(() => 'secret-access-token');
    const prototype = Object.defineProperties({}, {
      message: { get: getter }, context: { get: getter }, timestamp: { get: getter },
      level: { get: getter }, correlationId: { get: getter },
    });
    const payload = Object.assign(Object.create(prototype), { alert_type: 'REFUND_FAILED' });

    await service.forward(payload);

    expect(getter).not.toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((http.post as jest.Mock).mock.calls[0])).not.toContain('secret-access-token');
  });

  it('ignores non-critical payloads without a network call', async () => {
    process.env.ALERT_FORWARDER_ENABLED = 'true';
    const http = {
      post: jest.fn(() => of({ data: { ok: true } })),
    } as unknown as HttpService;
    const service = new AlertForwarderService(http);

    await service.forward({ message: 'normal log line', level: 'info' });

    expect(http.post).not.toHaveBeenCalled();
  });
});
