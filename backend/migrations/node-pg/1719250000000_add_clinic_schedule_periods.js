/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_schema.schedule_periods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      period_type text NOT NULL CHECK (period_type IN ('BLACKOUT','VACATION','EMERGENCY_DUTY')),
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      staff_id uuid REFERENCES clinic_schema.clinic_staff(id),
      resource_id uuid REFERENCES clinic_schema.clinic_resources(id),
      reason text,
      active boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'MANUAL',
      external_period_id text,
      created_by uuid,
      cancelled_by uuid,
      cancelled_at timestamptz,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK (ends_at > starts_at)
    );

    CREATE INDEX IF NOT EXISTS schedule_periods_location_time_idx
      ON clinic_schema.schedule_periods (clinic_location_id, starts_at, ends_at)
      WHERE active = true;

    CREATE INDEX IF NOT EXISTS schedule_periods_staff_time_idx
      ON clinic_schema.schedule_periods (staff_id, starts_at, ends_at)
      WHERE active = true AND staff_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS schedule_periods_resource_time_idx
      ON clinic_schema.schedule_periods (resource_id, starts_at, ends_at)
      WHERE active = true AND resource_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.schedule_periods_resource_time_idx;
    DROP INDEX IF EXISTS clinic_schema.schedule_periods_staff_time_idx;
    DROP INDEX IF EXISTS clinic_schema.schedule_periods_location_time_idx;
    DROP TABLE IF EXISTS clinic_schema.schedule_periods;
  `);
};
