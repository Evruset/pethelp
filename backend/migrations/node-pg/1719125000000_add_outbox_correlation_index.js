/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.outbox_events
      ADD COLUMN IF NOT EXISTS correlation_id uuid;

    CREATE INDEX IF NOT EXISTS outbox_events_correlation_idx
      ON booking_schema.outbox_events (correlation_id, created_at DESC)
      WHERE correlation_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.outbox_events_correlation_idx;
  `);
};
