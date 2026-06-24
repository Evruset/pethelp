/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    /* Immutable service pricing captured at hold creation. */
    ALTER TABLE clinic_schema.clinic_services
      ADD COLUMN IF NOT EXISTS price_amount numeric(12, 2) NOT NULL DEFAULT 1000.00,
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'RUB';

    ALTER TABLE clinic_schema.clinic_services
      DROP CONSTRAINT IF EXISTS clinic_services_price_amount_check;
    ALTER TABLE clinic_schema.clinic_services
      ADD CONSTRAINT clinic_services_price_amount_check CHECK (price_amount > 0);

    ALTER TABLE clinic_schema.clinic_services
      DROP CONSTRAINT IF EXISTS clinic_services_currency_check;
    ALTER TABLE clinic_schema.clinic_services
      ADD CONSTRAINT clinic_services_currency_check CHECK (currency ~ '^[A-Z]{3}$');

    CREATE TABLE IF NOT EXISTS booking_schema.hold_price_snapshots (
      hold_id uuid PRIMARY KEY REFERENCES booking_schema.booking_holds(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES clinic_schema.clinic_services(id),
      amount numeric(12, 2) NOT NULL CHECK (amount > 0),
      currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
      captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    INSERT INTO booking_schema.hold_price_snapshots (hold_id, service_id, amount, currency)
    SELECT h.id, s.service_id, cs.price_amount, cs.currency
    FROM booking_schema.booking_holds h
    JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
    JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
    ON CONFLICT (hold_id) DO NOTHING;

    CREATE OR REPLACE FUNCTION booking_schema.capture_hold_price_snapshot()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO booking_schema.hold_price_snapshots (hold_id, service_id, amount, currency)
      SELECT NEW.id, s.service_id, cs.price_amount, cs.currency
      FROM clinic_schema.appointment_slots s
      JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
      WHERE s.id = NEW.slot_id
      ON CONFLICT (hold_id) DO NOTHING;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS booking_hold_capture_price_snapshot ON booking_schema.booking_holds;
    CREATE TRIGGER booking_hold_capture_price_snapshot
      AFTER INSERT ON booking_schema.booking_holds
      FOR EACH ROW EXECUTE FUNCTION booking_schema.capture_hold_price_snapshot();

    CREATE OR REPLACE FUNCTION booking_schema.assert_hold_slot_matches_price_snapshot()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      snapshot_service_id uuid;
      next_service_id uuid;
    BEGIN
      IF NEW.slot_id = OLD.slot_id THEN
        RETURN NEW;
      END IF;
      SELECT service_id INTO snapshot_service_id
      FROM booking_schema.hold_price_snapshots
      WHERE hold_id = OLD.id;
      IF snapshot_service_id IS NULL THEN
        RETURN NEW;
      END IF;
      SELECT service_id INTO next_service_id
      FROM clinic_schema.appointment_slots
      WHERE id = NEW.slot_id;
      IF next_service_id IS DISTINCT FROM snapshot_service_id THEN
        RAISE EXCEPTION 'Alternative slot service does not match immutable hold price snapshot'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS booking_hold_enforce_price_snapshot_service ON booking_schema.booking_holds;
    CREATE TRIGGER booking_hold_enforce_price_snapshot_service
      BEFORE UPDATE OF slot_id ON booking_schema.booking_holds
      FOR EACH ROW EXECUTE FUNCTION booking_schema.assert_hold_slot_matches_price_snapshot();

    /* Counter updates from every bounded context get a single status derivation. */
    CREATE OR REPLACE FUNCTION clinic_schema.derive_slot_status()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.booked_count >= NEW.capacity THEN
        NEW.status := 'BOOKED';
      ELSIF NEW.held_count > 0 THEN
        NEW.status := 'LOCKED_BY_HOLD';
      ELSE
        NEW.status := 'AVAILABLE';
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS appointment_slot_derive_status ON clinic_schema.appointment_slots;
    CREATE TRIGGER appointment_slot_derive_status
      BEFORE INSERT OR UPDATE OF held_count, booked_count ON clinic_schema.appointment_slots
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.derive_slot_status();

    /* Network ambiguity is not a booking failure. It must be reconciled first. */
    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_state_check;
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_state_check
      CHECK (state IN (
        'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'SLA_BREACHED',
        'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING', 'MIS_HELD', 'PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING', 'MIS_BOOKING_FAILED'
      ));

    ALTER TABLE payment_schema.payment_intents
      ADD COLUMN IF NOT EXISTS correlation_id uuid;
    CREATE INDEX IF NOT EXISTS payment_intents_correlation_idx
      ON payment_schema.payment_intents (correlation_id, created_at DESC)
      WHERE correlation_id IS NOT NULL;

    CREATE OR REPLACE FUNCTION payment_schema.inherit_payment_correlation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.correlation_id IS NULL THEN
        SELECT correlation_id INTO NEW.correlation_id
        FROM booking_schema.outbox_events
        WHERE aggregate_type = 'booking_hold'
          AND aggregate_id = NEW.hold_id
          AND correlation_id IS NOT NULL
        ORDER BY created_at, id
        LIMIT 1;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS payment_intent_inherit_correlation ON payment_schema.payment_intents;
    CREATE TRIGGER payment_intent_inherit_correlation
      BEFORE INSERT ON payment_schema.payment_intents
      FOR EACH ROW EXECUTE FUNCTION payment_schema.inherit_payment_correlation();

    CREATE OR REPLACE FUNCTION booking_schema.inherit_payment_outbox_correlation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.correlation_id IS NULL AND NEW.aggregate_type = 'payment_intent' AND NEW.aggregate_id IS NOT NULL THEN
        SELECT correlation_id INTO NEW.correlation_id
        FROM payment_schema.payment_intents
        WHERE id = NEW.aggregate_id;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS outbox_inherit_payment_correlation ON booking_schema.outbox_events;
    CREATE TRIGGER outbox_inherit_payment_correlation
      BEFORE INSERT ON booking_schema.outbox_events
      FOR EACH ROW EXECUTE FUNCTION booking_schema.inherit_payment_outbox_correlation();

    CREATE OR REPLACE FUNCTION payment_schema.inherit_ledger_correlation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.correlation_id IS NULL THEN
        SELECT correlation_id INTO NEW.correlation_id
        FROM payment_schema.payment_intents
        WHERE id = NEW.payment_intent_id;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS ledger_inherit_payment_correlation ON payment_schema.ledger_entries;
    CREATE TRIGGER ledger_inherit_payment_correlation
      BEFORE INSERT ON payment_schema.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION payment_schema.inherit_ledger_correlation();

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_capability_verifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES clinic_schema.emergency_capability_profiles(id) ON DELETE CASCADE,
      reviewer_id uuid NOT NULL REFERENCES identity_schema.users(id),
      decision text NOT NULL CHECK (decision IN ('VERIFIED', 'REJECTED')),
      note text,
      decided_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS emergency_capability_verifications_profile_idx
      ON clinic_schema.emergency_capability_verifications (profile_id, decided_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS ledger_inherit_payment_correlation ON payment_schema.ledger_entries;
    DROP FUNCTION IF EXISTS payment_schema.inherit_ledger_correlation();
    DROP TRIGGER IF EXISTS outbox_inherit_payment_correlation ON booking_schema.outbox_events;
    DROP FUNCTION IF EXISTS booking_schema.inherit_payment_outbox_correlation();
    DROP TRIGGER IF EXISTS payment_intent_inherit_correlation ON payment_schema.payment_intents;
    DROP FUNCTION IF EXISTS payment_schema.inherit_payment_correlation();
    DROP INDEX IF EXISTS payment_schema.payment_intents_correlation_idx;
    ALTER TABLE payment_schema.payment_intents DROP COLUMN IF EXISTS correlation_id;

    DROP INDEX IF EXISTS clinic_schema.emergency_capability_verifications_profile_idx;
    DROP TABLE IF EXISTS clinic_schema.emergency_capability_verifications;

    DROP TRIGGER IF EXISTS appointment_slot_derive_status ON clinic_schema.appointment_slots;
    DROP FUNCTION IF EXISTS clinic_schema.derive_slot_status();
    DROP TRIGGER IF EXISTS booking_hold_enforce_price_snapshot_service ON booking_schema.booking_holds;
    DROP FUNCTION IF EXISTS booking_schema.assert_hold_slot_matches_price_snapshot();
    DROP TRIGGER IF EXISTS booking_hold_capture_price_snapshot ON booking_schema.booking_holds;
    DROP FUNCTION IF EXISTS booking_schema.capture_hold_price_snapshot();
    DROP TABLE IF EXISTS booking_schema.hold_price_snapshots;

    ALTER TABLE clinic_schema.clinic_services
      DROP CONSTRAINT IF EXISTS clinic_services_currency_check,
      DROP CONSTRAINT IF EXISTS clinic_services_price_amount_check,
      DROP COLUMN IF EXISTS currency,
      DROP COLUMN IF EXISTS price_amount;
  `);
};
