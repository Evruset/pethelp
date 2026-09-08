import { Injectable } from '@nestjs/common';
import { OtpDeliveryCommand, OtpDeliveryOutcome, OtpDeliveryPort } from './otp-delivery.port';

const allowed = new Set<OtpDeliveryOutcome>([
  'ACCEPTED', 'PROVIDER_REJECTED', 'PROVIDER_UNAVAILABLE',
  'PROVIDER_RETRYABLE_FAILURE', 'PROVIDER_FINAL_FAILURE',
  'PROVIDER_TIMEOUT', 'OUTCOME_UNKNOWN',
]);

@Injectable()
export class DeterministicOtpDeliveryStub implements OtpDeliveryPort {
  async sendOtp(_command: OtpDeliveryCommand): Promise<{ outcome: OtpDeliveryOutcome }> {
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      return { outcome: 'PROVIDER_FINAL_FAILURE' };
    }
    const configured = (process.env.AUTH_OTP_STUB_OUTCOME ?? 'ACCEPTED') as OtpDeliveryOutcome;
    return { outcome: allowed.has(configured) ? configured : 'PROVIDER_FINAL_FAILURE' };
  }
}
