/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.outbox_events
      ADD COLUMN IF NOT EXISTS causation_id uuid,
      ADD COLUMN IF NOT EXISTS traceparent text;

    CREATE INDEX IF NOT EXISTS outbox_events_causation_idx
      ON booking_schema.outbox_events (causation_id)
      WHERE causation_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS outbox_events_traceparent_idx
      ON booking_schema.outbox_events (traceparent)
      WHERE traceparent IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.outbox_events_traceparent_idx;
    DROP INDEX IF EXISTS booking_schema.outbox_events_causation_idx;

    ALTER TABLE booking_schema.outbox_events
      DROP COLUMN IF EXISTS traceparent,
      DROP COLUMN IF EXISTS causation_id;
  `);
};
