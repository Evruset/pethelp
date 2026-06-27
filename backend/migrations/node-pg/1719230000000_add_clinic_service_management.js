/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinic_services
      ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

    CREATE INDEX IF NOT EXISTS clinic_services_location_active_idx
      ON clinic_schema.clinic_services (clinic_location_id, active, display_name);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.clinic_services_location_active_idx;

    ALTER TABLE clinic_schema.clinic_services
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS version;
  `);
};
