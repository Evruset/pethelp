import type { HttpService } from '@nestjs/axios';
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
      correlationId: '11111111-1111-1111-1111-111111111111',
      alert_type: 'PAYMENT_FENCING_TRIGGERED',
      paymentIntentId: 'payment-1',
      userId: 'must-not-be-forwarded',
      rawProviderPayload: { sensitive: true },
    });

    expect(http.post).toHaveBeenCalledTimes(1);
    const [, body] = (http.post as jest.Mock).mock.calls[0] as [string, { text: string }];
    expect(body.text).toContain('PAYMENT_FENCING_TRIGGERED');
    expect(body.text).toContain('correlationId: 11111111-1111-1111-1111-111111111111');
    expect(body.text).toContain('paymentIntentId: payment-1');
    expect(body.text).not.toContain('must-not-be-forwarded');
    expect(body.text).not.toContain('rawProviderPayload');
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
