/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_sessions
      ADD COLUMN IF NOT EXISTS correlation_id uuid,
      ADD COLUMN IF NOT EXISTS ending_requested_at timestamptz,
      ADD COLUMN IF NOT EXISTS ending_requested_by uuid REFERENCES identity_schema.users(id);

    CREATE INDEX IF NOT EXISTS telemed_sessions_owner_state_idx
      ON telemed_schema.telemed_sessions (owner_id, state, updated_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS telemed_schema.telemed_sessions_owner_state_idx;
    ALTER TABLE telemed_schema.telemed_sessions
      DROP COLUMN IF EXISTS ending_requested_by,
      DROP COLUMN IF EXISTS ending_requested_at;
  `);
};
