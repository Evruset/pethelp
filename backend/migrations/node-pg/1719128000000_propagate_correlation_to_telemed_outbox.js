/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    /*
     * A trigger inherits a correlation ID from a transaction-local setting when
     * present; otherwise it uses the durable root booking event. This keeps
     * relay-driven transitions traceable even after process restarts.
     */
    CREATE OR REPLACE FUNCTION telemed_schema.enqueue_session_start_on_hold_confirmed()
    RETURNS trigger AS $$
    DECLARE
      trace_id uuid;
    BEGIN
      IF NEW.state = 'CONFIRMED' AND OLD.state IS DISTINCT FROM 'CONFIRMED' THEN
        trace_id := NULLIF(current_setting('vethelp.correlation_id', true), '')::uuid;
        IF trace_id IS NULL THEN
          SELECT e.correlation_id INTO trace_id
          FROM booking_schema.outbox_events e
          WHERE e.aggregate_type = 'booking_hold'
            AND e.aggregate_id = NEW.id
            AND e.correlation_id IS NOT NULL
          ORDER BY e.created_at, e.id
          LIMIT 1;
        END IF;

        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'telemed.session.start.requested.v1', trace_id, 'booking_hold', NEW.id,
          NEW.version,
          jsonb_build_object('bookingHoldId', NEW.id, 'correlationId', trace_id),
          'telemed.session.start.requested.v1:' || NEW.id::text
        ) ON CONFLICT (deduplication_key) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    /* A slot stays locked through MIS_HELD and becomes BOOKED only on payment confirmation. */
    CREATE OR REPLACE FUNCTION booking_schema.book_slot_on_mis_hold_confirmed()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.state = 'CONFIRMED' AND OLD.state = 'MIS_HELD' THEN
        UPDATE clinic_schema.appointment_slots
        SET held_count = held_count - 1,
            booked_count = booked_count + 1,
            status = CASE
              WHEN booked_count + 1 >= capacity THEN 'BOOKED'
              WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
              ELSE 'AVAILABLE'
            END,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = NEW.slot_id
          AND held_count > 0
          AND booked_count < capacity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Cannot book slot % while confirming hold %', NEW.slot_id, NEW.id
            USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS booking_hold_slot_book_on_payment_confirmation ON booking_schema.booking_holds;
    CREATE TRIGGER booking_hold_slot_book_on_payment_confirmation
      AFTER UPDATE OF state ON booking_schema.booking_holds
      FOR EACH ROW EXECUTE FUNCTION booking_schema.book_slot_on_mis_hold_confirmed();

    /* Any audit record written for a booking hold inherits the root trace if omitted. */
    CREATE OR REPLACE FUNCTION audit_schema.inherit_booking_hold_correlation()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.correlation_id IS NULL AND NEW.aggregate_type = 'booking_hold' THEN
        SELECT e.correlation_id INTO NEW.correlation_id
        FROM booking_schema.outbox_events e
        WHERE e.aggregate_type = 'booking_hold'
          AND e.aggregate_id = NEW.aggregate_id
          AND e.correlation_id IS NOT NULL
        ORDER BY e.created_at, e.id
        LIMIT 1;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS audit_log_inherit_booking_hold_correlation ON audit_schema.audit_log;
    CREATE TRIGGER audit_log_inherit_booking_hold_correlation
      BEFORE INSERT ON audit_schema.audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_schema.inherit_booking_hold_correlation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS audit_log_inherit_booking_hold_correlation ON audit_schema.audit_log;
    DROP FUNCTION IF EXISTS audit_schema.inherit_booking_hold_correlation();
    DROP TRIGGER IF EXISTS booking_hold_slot_book_on_payment_confirmation ON booking_schema.booking_holds;
    DROP FUNCTION IF EXISTS booking_schema.book_slot_on_mis_hold_confirmed();

    CREATE OR REPLACE FUNCTION telemed_schema.enqueue_session_start_on_hold_confirmed()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.state = 'CONFIRMED' AND OLD.state IS DISTINCT FROM 'CONFIRMED' THEN
        INSERT INTO booking_schema.outbox_events (
          event_type, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'telemed.session.start.requested.v1', 'booking_hold', NEW.id,
          NEW.version, jsonb_build_object('bookingHoldId', NEW.id),
          'telemed.session.start.requested.v1:' || NEW.id::text
        ) ON CONFLICT (deduplication_key) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};
