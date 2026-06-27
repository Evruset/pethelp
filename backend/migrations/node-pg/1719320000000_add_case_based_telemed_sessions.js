/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_sessions
      ALTER COLUMN booking_hold_id DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS telemed_case_id uuid REFERENCES telemed_schema.telemed_cases(id);

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_sessions_case_id_uq
      ON telemed_schema.telemed_sessions (telemed_case_id)
      WHERE telemed_case_id IS NOT NULL;

    ALTER TABLE telemed_schema.telemed_sessions
      DROP CONSTRAINT IF EXISTS telemed_sessions_exactly_one_source_check;
    ALTER TABLE telemed_schema.telemed_sessions
      ADD CONSTRAINT telemed_sessions_exactly_one_source_check
      CHECK (
        ((booking_hold_id IS NOT NULL)::integer + (telemed_case_id IS NOT NULL)::integer) = 1
      ) NOT VALID;
    ALTER TABLE telemed_schema.telemed_sessions
      VALIDATE CONSTRAINT telemed_sessions_exactly_one_source_check;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_sessions
      DROP CONSTRAINT IF EXISTS telemed_sessions_exactly_one_source_check;
    DROP INDEX IF EXISTS telemed_schema.telemed_sessions_case_id_uq;
    ALTER TABLE telemed_schema.telemed_sessions
      DROP COLUMN IF EXISTS telemed_case_id;
    ALTER TABLE telemed_schema.telemed_sessions
      ALTER COLUMN booking_hold_id SET NOT NULL;
  `);
};
