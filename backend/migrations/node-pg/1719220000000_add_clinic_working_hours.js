/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_schema.location_working_hours (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id) ON DELETE CASCADE,
      weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
      opens_at time,
      closes_at time,
      active boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'MANUAL',
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      UNIQUE (clinic_location_id, weekday),
      CHECK (
        active = false
        OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at > opens_at)
      )
    );

    CREATE INDEX IF NOT EXISTS location_working_hours_location_idx
      ON clinic_schema.location_working_hours (clinic_location_id, weekday);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.location_working_hours_location_idx;
    DROP TABLE IF EXISTS clinic_schema.location_working_hours;
  `);
};
