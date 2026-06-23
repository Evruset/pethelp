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

    CREATE OR REPLACE FUNCTION telemed_schema.enqueue_session_start_on_hold_confirmed()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.state = 'CONFIRMED' AND OLD.state IS DISTINCT FROM 'CONFIRMED' THEN
        INSERT INTO booking_schema.outbox_events (
          event_type, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'telemed.session.start.requested.v1',
          'booking_hold',
          NEW.id,
          NEW.version,
          jsonb_build_object('bookingHoldId', NEW.id),
          'telemed.session.start.requested.v1:' || NEW.id::text
        )
        ON CONFLICT (deduplication_key) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS booking_hold_telemed_start_outbox ON booking_schema.booking_holds;
    CREATE TRIGGER booking_hold_telemed_start_outbox
      AFTER UPDATE OF state ON booking_schema.booking_holds
      FOR EACH ROW EXECUTE FUNCTION telemed_schema.enqueue_session_start_on_hold_confirmed();

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
    DROP TRIGGER IF EXISTS booking_hold_telemed_start_outbox ON booking_schema.booking_holds;
    DROP FUNCTION IF EXISTS telemed_schema.enqueue_session_start_on_hold_confirmed();

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
