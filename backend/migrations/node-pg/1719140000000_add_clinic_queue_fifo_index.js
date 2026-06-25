/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS booking_holds_manual_confirmation_fifo_idx
      ON booking_schema.booking_holds (state_changed_at ASC, id ASC)
      WHERE state = 'MANUAL_CONFIRM_PENDING'
        AND confirmation_sla_expires_at IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.booking_holds_manual_confirmation_fifo_idx;
  `);
};
