import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ code, message }, status);
  }
}

export const DomainErrors = {
  slotNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'SLOT_NOT_FOUND', 'Slot not found'),
  holdNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'HOLD_NOT_FOUND', 'Hold not found'),
  slotAlreadyTaken: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_ALREADY_TAKEN', 'Slot unavailable'),
  slotLockedRetry: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_LOCKED_RETRY', 'Retry shortly'),
  holdExpired: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'HOLD_EXPIRED', 'Hold expired'),
  invalidTransition: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_STATE_TRANSITION', 'Transition is not allowed'),
  holdOwnerMismatch: () => new DomainException(HttpStatus.FORBIDDEN, 'HOLD_OWNER_MISMATCH', 'Owner mismatch'),
  clinicScopeMismatch: () => new DomainException(HttpStatus.FORBIDDEN, 'CLINIC_SCOPE_MISMATCH', 'Clinic scope mismatch'),
  idempotencyInProgress: () => new DomainException(425, 'IDEMPOTENCY_IN_PROGRESS', 'Command is in progress'),
  workerUnauthorized: () => new DomainException(HttpStatus.FORBIDDEN, 'WORKER_UNAUTHORIZED', 'Worker key is invalid'),
  bookingUnavailable: () => new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'BOOKING_TEMPORARILY_UNAVAILABLE', 'Booking unavailable'),
};
