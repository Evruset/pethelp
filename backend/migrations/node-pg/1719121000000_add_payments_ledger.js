/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS payment_schema;

    CREATE TABLE IF NOT EXISTS payment_schema.payment_intents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      hold_id uuid NOT NULL REFERENCES booking_schema.booking_holds(id),
      hold_version integer NOT NULL CHECK (hold_version > 0),
      amount numeric(12,2) NOT NULL CHECK (amount > 0),
      status text NOT NULL CHECK (status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'VOIDED', 'FAILED')),
      idempotency_key varchar(128) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_hold_version_fence_idx
      ON payment_schema.payment_intents (hold_id, hold_version);

    CREATE INDEX IF NOT EXISTS payment_intents_hold_idx
      ON payment_schema.payment_intents (hold_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS payment_schema.payment_intents;
    DROP SCHEMA IF EXISTS payment_schema;
  `);
};
