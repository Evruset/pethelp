/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_cases
      DROP CONSTRAINT IF EXISTS telemed_cases_state_check;
    ALTER TABLE telemed_schema.telemed_cases
      ADD CONSTRAINT telemed_cases_state_check
      CHECK (state IN (
        'DRAFT', 'PAYMENT_PENDING', 'FUNDS_RESERVED', 'QUEUED', 'ASSIGNED',
        'DOCTOR_JOINED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED',
        'EXPIRED_NO_DOCTOR', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED_BY_OWNER'
      ));

    ALTER TABLE telemed_schema.telemed_sessions
      DROP CONSTRAINT IF EXISTS telemed_sessions_state_check;
    ALTER TABLE telemed_schema.telemed_sessions
      ADD CONSTRAINT telemed_sessions_state_check
      CHECK (state IN (
        'WAITING_FOR_DOCTOR', 'CONNECTED', 'COMPLETED', 'DOCTOR_TIMEOUT', 'CANCELLED'
      ));

    ALTER TABLE telemed_schema.telemed_sessions
      ADD COLUMN IF NOT EXISTS owner_cancelled_at timestamptz,
      ADD COLUMN IF NOT EXISTS owner_cancel_idempotency_key uuid;

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_sessions_owner_cancel_idempotency_uq
      ON telemed_schema.telemed_sessions (owner_id, owner_cancel_idempotency_key)
      WHERE owner_cancel_idempotency_key IS NOT NULL;

    ALTER TABLE telemed_schema.telemed_case_events
      DROP CONSTRAINT IF EXISTS telemed_case_events_event_type_check;
    ALTER TABLE telemed_schema.telemed_case_events
      ADD CONSTRAINT telemed_case_events_event_type_check
      CHECK (event_type IN (
        'ASSIGNED', 'SESSION_STARTED', 'DOCTOR_CONNECTED', 'DOCTOR_TIMEOUT',
        'SAFETY_ESCALATED', 'RECOMMENDATION_SAVED', 'FOLLOW_UP_ROUTED', 'OWNER_CANCELLED'
      ));

    ALTER TABLE telemed_schema.telemed_payment_events
      DROP CONSTRAINT IF EXISTS telemed_payment_events_event_type_check;
    ALTER TABLE telemed_schema.telemed_payment_events
      ADD CONSTRAINT telemed_payment_events_event_type_check
      CHECK (event_type IN (
        'PROVIDER_WEBHOOK_RECEIVED', 'AUTHORIZED', 'QUEUE_ENTERED',
        'DUPLICATE_WEBHOOK_OBSERVED', 'STALE_WEBHOOK_IGNORED', 'VOID_REQUESTED',
        'VOID_SENT', 'REFUND_PENDING', 'REFUND_DISPATCHED'
      ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM telemed_schema.telemed_sessions WHERE state = 'CANCELLED')
        OR EXISTS (SELECT 1 FROM telemed_schema.telemed_cases WHERE state = 'CANCELLED_BY_OWNER') THEN
        RAISE EXCEPTION 'Cannot roll back telemed owner cancellation while cancelled records exist';
      END IF;
    END $$;

    DROP INDEX IF EXISTS telemed_schema.telemed_sessions_owner_cancel_idempotency_uq;
    ALTER TABLE telemed_schema.telemed_sessions
      DROP COLUMN IF EXISTS owner_cancel_idempotency_key,
      DROP COLUMN IF EXISTS owner_cancelled_at;

    ALTER TABLE telemed_schema.telemed_cases
      DROP CONSTRAINT IF EXISTS telemed_cases_state_check;
    ALTER TABLE telemed_schema.telemed_cases
      ADD CONSTRAINT telemed_cases_state_check
      CHECK (state IN (
        'DRAFT', 'PAYMENT_PENDING', 'FUNDS_RESERVED', 'QUEUED', 'ASSIGNED',
        'DOCTOR_JOINED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED',
        'EXPIRED_NO_DOCTOR', 'REFUND_PENDING', 'REFUNDED'
      ));

    ALTER TABLE telemed_schema.telemed_sessions
      DROP CONSTRAINT IF EXISTS telemed_sessions_state_check;
    ALTER TABLE telemed_schema.telemed_sessions
      ADD CONSTRAINT telemed_sessions_state_check
      CHECK (state IN ('WAITING_FOR_DOCTOR', 'CONNECTED', 'COMPLETED', 'DOCTOR_TIMEOUT'));

    ALTER TABLE telemed_schema.telemed_case_events
      DROP CONSTRAINT IF EXISTS telemed_case_events_event_type_check;
    ALTER TABLE telemed_schema.telemed_case_events
      ADD CONSTRAINT telemed_case_events_event_type_check
      CHECK (event_type IN (
        'ASSIGNED', 'SESSION_STARTED', 'DOCTOR_CONNECTED', 'DOCTOR_TIMEOUT',
        'SAFETY_ESCALATED', 'RECOMMENDATION_SAVED', 'FOLLOW_UP_ROUTED'
      ));

    ALTER TABLE telemed_schema.telemed_payment_events
      DROP CONSTRAINT IF EXISTS telemed_payment_events_event_type_check;
    ALTER TABLE telemed_schema.telemed_payment_events
      ADD CONSTRAINT telemed_payment_events_event_type_check
      CHECK (event_type IN (
        'PROVIDER_WEBHOOK_RECEIVED', 'AUTHORIZED', 'QUEUE_ENTERED',
        'DUPLICATE_WEBHOOK_OBSERVED', 'VOID_REQUESTED', 'VOID_SENT',
        'REFUND_PENDING', 'REFUND_DISPATCHED'
      ));
  `);
};
