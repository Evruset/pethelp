/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.outbox_events
      ADD COLUMN IF NOT EXISTS correlation_id uuid;

    CREATE INDEX IF NOT EXISTS outbox_events_correlation_idx
      ON booking_schema.outbox_events (correlation_id, created_at DESC)
      WHERE correlation_id IS NOT NULL;

    CREATE OR REPLACE FUNCTION booking_schema.apply_transaction_correlation_to_outbox()
    RETURNS trigger AS $$
    DECLARE
      current_correlation text;
    BEGIN
      IF NEW.correlation_id IS NULL THEN
        current_correlation := current_setting('app.correlation_id', true);
        IF current_correlation IS NOT NULL
          AND current_correlation ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
          NEW.correlation_id := current_correlation::uuid;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS outbox_apply_transaction_correlation ON booking_schema.outbox_events;
    CREATE TRIGGER outbox_apply_transaction_correlation
      BEFORE INSERT ON booking_schema.outbox_events
      FOR EACH ROW EXECUTE FUNCTION booking_schema.apply_transaction_correlation_to_outbox();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS outbox_apply_transaction_correlation ON booking_schema.outbox_events;
    DROP FUNCTION IF EXISTS booking_schema.apply_transaction_correlation_to_outbox();
    DROP INDEX IF EXISTS booking_schema.outbox_events_correlation_idx;
  `);
};
