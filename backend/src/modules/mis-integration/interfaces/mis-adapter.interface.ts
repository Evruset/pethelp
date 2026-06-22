export type MisReservationStatus = 'SUCCESS' | 'FAILED';

export interface MisReservationRequest {
  internalHoldId: string;
  slotId: string;
  clinicId: string;
  externalPatientId: string;
  correlationId?: string;
}

export interface MisReservationResult {
  externalHoldId?: string;
  status: MisReservationStatus;
  ttlMinutes?: number;
  rawError?: string;
}

export interface IMisAdapter {
  reserve(request: MisReservationRequest): Promise<MisReservationResult>;
}

export class MisNetworkError extends Error {
  readonly retriable = true;
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MisNetworkError';
  }
}

export class MisConfigurationError extends Error {
  readonly retriable = false;
  constructor(message: string) {
    super(message);
    this.name = 'MisConfigurationError';
  }
}
