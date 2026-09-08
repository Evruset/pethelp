/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.idempotency_records
      ADD COLUMN IF NOT EXISTS request_fingerprint text;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.idempotency_records
      DROP COLUMN IF EXISTS request_fingerprint;
  `);
};
