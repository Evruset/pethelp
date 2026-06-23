/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS telemed_schema;

    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_hold_id uuid NOT NULL UNIQUE REFERENCES booking_schema.booking_holds(id),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      doctor_id uuid,
      state text NOT NULL CHECK (state IN (
        'WAITING_FOR_DOCTOR',
        'CONNECTED',
        'COMPLETED',
        'DOCTOR_TIMEOUT'
      )),
      room_name varchar(160) NOT NULL UNIQUE,
      version integer NOT NULL DEFAULT 1,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_sessions_state_idx
      ON telemed_schema.telemed_sessions (state, expires_at);

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'VOID_REQUESTED',
        'VOIDED',
        'FAILED'
      ));

    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (
        'INTENT_CREATED',
        'PROVIDER_INTENT_CREATED',
        'PROVIDER_INTENT_FAILED',
        'WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'CAPTURE_REQUESTED',
        'CAPTURE_SENT',
        'CAPTURE_CONFIRMED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'VOID_CONFIRMED',
        'RECONCILIATION_OBSERVED',
        'SLA_BREACH_AUTOMATIC_VOID'
      ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (
        'INTENT_CREATED',
        'PROVIDER_INTENT_CREATED',
        'PROVIDER_INTENT_FAILED',
        'WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'CAPTURE_REQUESTED',
        'CAPTURE_SENT',
        'CAPTURE_CONFIRMED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'VOID_CONFIRMED',
        'RECONCILIATION_OBSERVED'
      ));

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'VOIDED',
        'FAILED'
      ));

    DROP TABLE IF EXISTS telemed_schema.telemed_sessions;
    DROP SCHEMA IF EXISTS telemed_schema;
  `);
};
