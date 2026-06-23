/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    /*
     * PaymentService sets vethelp.correlation_id locally before it confirms a
     * hold. The trigger runs in the same PostgreSQL transaction, making the
     * durable CONFIRMED -> telemed outbox handoff traceable without trusting a
     * client-supplied value inside the trigger itself.
     */
    CREATE OR REPLACE FUNCTION telemed_schema.enqueue_session_start_on_hold_confirmed()
    RETURNS trigger AS $$
    DECLARE
      trace_id uuid;
    BEGIN
      IF NEW.state = 'CONFIRMED' AND OLD.state IS DISTINCT FROM 'CONFIRMED' THEN
        trace_id := NULLIF(current_setting('vethelp.correlation_id', true), '')::uuid;

        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'telemed.session.start.requested.v1',
          trace_id,
          'booking_hold',
          NEW.id,
          NEW.version,
          jsonb_build_object('bookingHoldId', NEW.id, 'correlationId', trace_id),
          'telemed.session.start.requested.v1:' || NEW.id::text
        )
        ON CONFLICT (deduplication_key) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
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
  `);
};
