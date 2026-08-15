const IDENTIFIER_FIELDS = new Set([
  'appointmentId', 'bookingHoldId', 'coverageCheckId', 'holdId', 'outboxEventId',
  'paymentIntentId', 'providerEventId', 'slotId', 'telemedCaseId',
]);

const FIELD_VALUES: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  alert_type: new Set(['MIS_INTEGRATION_TIMEOUT', 'PAYMENT_FENCING_TRIGGERED', 'SLA_AUTO_VOID_FAILED', 'REFUND_FAILED', 'CLINIC_SLA_BREACHED']),
  errorCode: new Set(['ALERT_FORWARDER_REJECTED', 'ALERT_FORWARDER_UNKNOWN']),
  feature_state: new Set(['ENABLED', 'DISABLED']),
  freshness_state: new Set(['FRESH', 'STALE', 'UNKNOWN']),
  metric: new Set(['vethelp_business_failure_total']),
  method: new Set(['GET']),
  outcome: new Set([
    'FOUND', 'EMPTY', 'VALIDATION_REJECTED', 'INVALID_COMBINATION', 'AUTH_DENIED',
    'SCOPE_UNAVAILABLE', 'POLICY_UNAVAILABLE', 'RATE_LIMITED', 'TECHNICAL_ERROR',
    'INVARIANT_VIOLATION', 'FLAG_DISABLED', 'COMPLETE', 'PARTIAL', 'CONFIRMED',
  ]),
  provider: new Set(['SIMULATED_OCR']),
  query_length_bucket: new Set(['EMPTY', 'SHORT', 'MEDIUM', 'LONG', 'OVERSIZED']),
  role_class: new Set(['RECEPTION', 'ADMIN', 'VETERINARIAN', 'MULTI_ROLE', 'UNKNOWN']),
  route: new Set(['/v1/clinic/:clinicId/locations/:locationId/patients?administrativeReference=[REDACTED]']),
  state: new Set([
    'OPEN', 'CLOSED', 'CANCELLED', 'MIS_HELD', 'MANUAL_CONFIRM_PENDING',
    'ALTERNATIVE_PENDING', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'COMPLETED',
    'RELEASED', 'SLA_BREACHED', 'EXPIRED', 'REQUESTED', 'CONSENT_REQUIRED',
    'MANUAL_REVIEW', 'NOT_COVERED', 'COVERED',
  ]),
});

const NUMBER_FIELDS = new Set(['attempt', 'duration_ms', 'expired', 'port', 'result_count', 'retryAfterMs', 'status_code']);
const BOOLEAN_FIELDS = new Set(['enabled', 'success']);
const SECTION_ARRAY_FIELDS = new Set(['available_sections', 'degraded_sections', 'not_authorized_sections', 'not_configured_sections']);
const SECTION_VALUES = new Set(['QUEUE', 'SCHEDULE', 'APPOINTMENTS', 'VETERINARIAN', 'QUALITY']);
const IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_CONTEXTS = new Set([
  'AlertForwarder', 'AlternativeSlotExpirationWorker', 'BookingCore', 'Bootstrap',
  'ClinicSlaMonitorWorker', 'ClinicWorkspaceHomeTelemetry', 'InsuranceCoverageWorker',
  'LiveKitWebhookService', 'MisOutboxRelayWorker', 'PaymentOutboxRelayWorker',
  'PaymentReconciliationWorker', 'PaymentRefundService', 'PaymentWebhookService', 'RegistryReferenceAccess',
  'RegistryReferenceTelemetry', 'Security', 'TelemedSessionStartWorker', 'TelemedSlaWorker',
]);

const SAFE_MESSAGES = new Set([
  'ALERT_FORWARDING_FAILED', 'Alternative slot expiration worker failed',
  'Clinic manual confirmation SLA breached; hold released automatically',
  'Clinic manual confirmation SLA monitor failed', 'Creating local hold',
  'Doctor SLA timeout queued authorization void', 'Doctor SLA timeout queued captured-payment refund',
  'Doctor SLA timeout queued telemedicine authorization void', 'Doctor joined LiveKit telemedicine room',
  'Expired unaccepted alternative booking slot proposal(s)', 'Insurance coverage request failed',
  'Insurance coverage request processed', 'LiveKit room finished and session completed',
  'LiveKit webhook ignored', 'MIS outbox delivery failed', 'MIS outbox event failed',
  'MIS outbox event processed', 'Payment fence rejected provider authorization',
  'Payment provider outbox event failed', 'Payment provider outbox event processed',
  'Payment fencing rejected a late provider callback',
  'Acquiring refund dispatch failed', 'Refund confirmation processing failed',
  'Telemedicine SLA enforcement failed', 'Telemedicine SLA worker failed',
  'Telemedicine session activation failed', 'Telemedicine session started from outbox',
  'VetHelp listening', 'booking.command.completed', 'clinic.registry.reference_search.completed',
  'clinic.registry.reference_search.invariant_violation', 'clinic.registry.reference_search.policy_unavailable',
  'clinic.registry.reference_search.rate_limited', 'clinic.workspace_home.completed',
  'http.request.completed', 'telemetry.sanitizer.failed', 'telemetry.security.checked',
]);

export const TELEMETRY_RESERVED_FIELDS = new Set([
  'timestamp', 'level', 'severity', 'service', 'environment', 'event', 'context', 'message',
  'correlationId', 'correlation_id', 'requestId', 'request_id', 'userId',
]);

export function sanitizeTelemetryFields(fields: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const descriptors = Object.getOwnPropertyDescriptors(fields);

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!('value' in descriptor)) continue;
    const value = descriptor.value;
    if (TELEMETRY_RESERVED_FIELDS.has(key) || value === null || value === undefined) continue;
    if (IDENTIFIER_FIELDS.has(key)) {
      if (typeof value === 'string' && IDENTIFIER.test(value)) safe[key] = value;
      continue;
    }
    const allowedValues = FIELD_VALUES[key];
    if (allowedValues) {
      if (typeof value === 'string' && allowedValues.has(value)) safe[key] = value;
      continue;
    }
    if (NUMBER_FIELDS.has(key)) {
      if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
      continue;
    }
    if (BOOLEAN_FIELDS.has(key)) {
      if (typeof value === 'boolean') safe[key] = value;
      continue;
    }
    if (SECTION_ARRAY_FIELDS.has(key) && Array.isArray(value) && value.length <= 16
      && value.every((item) => typeof item === 'string' && SECTION_VALUES.has(item))) {
      safe[key] = Object.freeze([...value]);
    }
  }
  return safe;
}

export function safeTelemetryMessage(message: unknown): string {
  return typeof message === 'string' && SAFE_MESSAGES.has(message.trim())
    ? message.trim() : 'UNSAFE_TELEMETRY_MESSAGE_DROPPED';
}

export function safeTelemetryContext(context: unknown): string {
  return typeof context === 'string' && SAFE_CONTEXTS.has(context) ? context : 'VetHelp';
}

export function safeTelemetryCorrelationId(value: unknown): string | undefined {
  return typeof value === 'string' && IDENTIFIER.test(value) ? value : undefined;
}
