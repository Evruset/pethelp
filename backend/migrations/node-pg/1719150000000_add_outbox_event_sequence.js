/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SEQUENCE IF NOT EXISTS booking_schema.outbox_event_sequence;

    ALTER TABLE booking_schema.outbox_events
      ADD COLUMN IF NOT EXISTS event_sequence bigint;

    ALTER TABLE booking_schema.outbox_events
      ALTER COLUMN event_sequence
      SET DEFAULT nextval('booking_schema.outbox_event_sequence');

    UPDATE booking_schema.outbox_events
    SET event_sequence = nextval('booking_schema.outbox_event_sequence')
    WHERE event_sequence IS NULL;

    ALTER TABLE booking_schema.outbox_events
      ALTER COLUMN event_sequence SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS outbox_event_sequence_idx
      ON booking_schema.outbox_events (event_sequence);

    CREATE INDEX IF NOT EXISTS outbox_aggregate_replay_idx
      ON booking_schema.outbox_events (aggregate_type, aggregate_id, aggregate_version, event_sequence);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.outbox_aggregate_replay_idx;
    DROP INDEX IF EXISTS booking_schema.outbox_event_sequence_idx;
    ALTER TABLE booking_schema.outbox_events DROP COLUMN IF EXISTS event_sequence;
    DROP SEQUENCE IF EXISTS booking_schema.outbox_event_sequence;
  `);
};
