/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_schema.clinic_staff (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      code text NOT NULL,
      display_name text NOT NULL,
      role text NOT NULL DEFAULT 'VETERINARIAN',
      active boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'MANUAL',
      external_staff_id text,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      UNIQUE (clinic_location_id, code)
    );

    CREATE TABLE IF NOT EXISTS clinic_schema.clinic_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      code text NOT NULL,
      display_name text NOT NULL,
      resource_type text NOT NULL DEFAULT 'CABINET',
      active boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'MANUAL',
      external_resource_id text,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      UNIQUE (clinic_location_id, code)
    );

    ALTER TABLE clinic_schema.appointment_slots
      ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES clinic_schema.clinic_staff(id),
      ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES clinic_schema.clinic_resources(id);

    CREATE INDEX IF NOT EXISTS clinic_staff_location_active_idx
      ON clinic_schema.clinic_staff (clinic_location_id, active, display_name);

    CREATE INDEX IF NOT EXISTS clinic_resources_location_active_idx
      ON clinic_schema.clinic_resources (clinic_location_id, active, display_name);

    CREATE INDEX IF NOT EXISTS appointment_slots_staff_time_idx
      ON clinic_schema.appointment_slots (staff_id, starts_at)
      WHERE staff_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS appointment_slots_resource_time_idx
      ON clinic_schema.appointment_slots (resource_id, starts_at)
      WHERE resource_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_resource_time_idx;
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_staff_time_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_resources_location_active_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_staff_location_active_idx;

    ALTER TABLE clinic_schema.appointment_slots
      DROP COLUMN IF EXISTS resource_id,
      DROP COLUMN IF EXISTS staff_id;

    DROP TABLE IF EXISTS clinic_schema.clinic_resources;
    DROP TABLE IF EXISTS clinic_schema.clinic_staff;
  `);
};
