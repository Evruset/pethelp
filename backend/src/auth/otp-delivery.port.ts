export type OtpDeliveryOutcome =
  | 'ACCEPTED'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RETRYABLE_FAILURE'
  | 'PROVIDER_FINAL_FAILURE'
  | 'PROVIDER_TIMEOUT'
  | 'OUTCOME_UNKNOWN';

export type OtpDeliveryCommand = {
  deliveryAttemptId: string;
  challengeId: string;
  destination: string;
  otpCode: string;
  expiresAt: Date;
  correlationId: string;
};

export interface OtpDeliveryPort {
  sendOtp(command: OtpDeliveryCommand): Promise<{ outcome: OtpDeliveryOutcome }>;
}

export const OTP_DELIVERY_PORT = Symbol('OTP_DELIVERY_PORT');
