import { DeterministicOtpDeliveryStub } from './deterministic-otp-delivery.stub';
import { OtpDeliveryOutcome } from './otp-delivery.port';

describe('DeterministicOtpDeliveryStub', () => {
  const original = process.env.AUTH_OTP_STUB_OUTCOME;
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_OTP_STUB_OUTCOME;
    else process.env.AUTH_OTP_STUB_OUTCOME = original;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it.each([
    'ACCEPTED',
    'PROVIDER_REJECTED',
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_RETRYABLE_FAILURE',
    'PROVIDER_FINAL_FAILURE',
    'PROVIDER_TIMEOUT',
    'OUTCOME_UNKNOWN',
  ] as OtpDeliveryOutcome[])('models %s through the provider-neutral port', async (outcome) => {
    process.env.AUTH_OTP_STUB_OUTCOME = outcome;
    const result = await new DeterministicOtpDeliveryStub().sendOtp({
      deliveryAttemptId: '11111111-1111-4111-8111-111111111111',
      challengeId: '22222222-2222-4222-8222-222222222222',
      destination: '+79991234567',
      otpCode: '123456',
      expiresAt: new Date('2026-08-11T12:05:00.000Z'),
      correlationId: '33333333-3333-4333-8333-333333333333',
    });
    expect(result).toEqual({ outcome });
  });

  it('fails a malformed configured outcome closed without reflecting it', async () => {
    process.env.AUTH_OTP_STUB_OUTCOME = 'secret-provider-message';
    await expect(new DeterministicOtpDeliveryStub().sendOtp({} as never))
      .resolves.toEqual({ outcome: 'PROVIDER_FINAL_FAILURE' });
  });

  it('cannot acknowledge delivery in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_OTP_STUB_OUTCOME = 'ACCEPTED';
    await expect(new DeterministicOtpDeliveryStub().sendOtp({} as never))
      .resolves.toEqual({ outcome: 'PROVIDER_FINAL_FAILURE' });
  });
});
