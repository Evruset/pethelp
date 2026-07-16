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
  slotVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_VERSION_STALE', 'Slot version is stale'),
  idempotencyPayloadConflict: () => new DomainException(HttpStatus.CONFLICT, 'IDEMPOTENCY_PAYLOAD_CONFLICT', 'Idempotency key was already used for another request'),
  serviceNotAvailable: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SERVICE_NOT_AVAILABLE', 'Service is not available'),
  doctorNotAvailable: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'DOCTOR_NOT_AVAILABLE', 'Doctor is not available'),
  slotHasActiveBookings: () => new DomainException(HttpStatus.CONFLICT, 'SLOT_HAS_ACTIVE_BOOKINGS', 'Slot has active holds or bookings'),
  serviceNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'SERVICE_NOT_FOUND', 'Service not found'),
  serviceCodeExists: () => new DomainException(HttpStatus.CONFLICT, 'SERVICE_CODE_EXISTS', 'Service code already exists for location'),
  serviceVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'SERVICE_VERSION_STALE', 'Service version is stale'),
  serviceHasActiveBookings: () => new DomainException(HttpStatus.CONFLICT, 'SERVICE_HAS_ACTIVE_BOOKINGS', 'Service has future active holds or bookings'),
  staffNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'STAFF_NOT_FOUND', 'Staff member not found'),
  staffCodeExists: () => new DomainException(HttpStatus.CONFLICT, 'STAFF_CODE_EXISTS', 'Staff code already exists for location'),
  staffVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'STAFF_VERSION_STALE', 'Staff version is stale'),
  staffHasActiveBookings: () => new DomainException(HttpStatus.CONFLICT, 'STAFF_HAS_ACTIVE_BOOKINGS', 'Staff member has future active holds or bookings'),
  resourceNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', 'Resource not found'),
  resourceCodeExists: () => new DomainException(HttpStatus.CONFLICT, 'RESOURCE_CODE_EXISTS', 'Resource code already exists for location'),
  resourceVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'RESOURCE_VERSION_STALE', 'Resource version is stale'),
  resourceHasActiveBookings: () => new DomainException(HttpStatus.CONFLICT, 'RESOURCE_HAS_ACTIVE_BOOKINGS', 'Resource has future active holds or bookings'),
  schedulePeriodNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'SCHEDULE_PERIOD_NOT_FOUND', 'Schedule period not found'),
  schedulePeriodVersionStale: () => new DomainException(HttpStatus.CONFLICT, 'SCHEDULE_PERIOD_VERSION_STALE', 'Schedule period version is stale'),
  schedulePeriodHasActiveBookings: () => new DomainException(HttpStatus.CONFLICT, 'SCHEDULE_PERIOD_HAS_ACTIVE_BOOKINGS', 'Schedule period overlaps active holds or bookings'),
  alternativeSwapNotFound: () => new DomainException(HttpStatus.NOT_FOUND, 'ALTERNATIVE_SWAP_NOT_FOUND', 'Alternative swap group not found'),
  queueFifoViolation: () => new DomainException(HttpStatus.CONFLICT, 'QUEUE_FIFO_VIOLATION', 'Confirm the earliest pending request first'),
  slotUnavailable: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SLOT_UNAVAILABLE', 'Slot is not available for booking'),
  holdAlreadyActive: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'HOLD_ALREADY_ACTIVE', 'Owner already has an active hold for this slot'),
  holdExpired: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'HOLD_EXPIRED', 'Hold expired'),
  invalidTransition: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_STATE_TRANSITION', 'Transition is not allowed'),
  holdOwnerMismatch: () => new DomainException(HttpStatus.FORBIDDEN, 'HOLD_OWNER_MISMATCH', 'Owner mismatch'),
  petOwnershipMismatch: () => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PET_OWNERSHIP_MISMATCH', 'Pet ownership mismatch'),
  clinicScopeMismatch: () => new DomainException(HttpStatus.FORBIDDEN, 'CLINIC_SCOPE_MISMATCH', 'Clinic scope mismatch'),
  idempotencyInProgress: () => new DomainException(425, 'IDEMPOTENCY_IN_PROGRESS', 'Command is in progress'),
  workerUnauthorized: () => new DomainException(HttpStatus.FORBIDDEN, 'WORKER_UNAUTHORIZED', 'Worker key is invalid'),
  bookingUnavailable: () => new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'BOOKING_TEMPORARILY_UNAVAILABLE', 'Booking unavailable'),
};
