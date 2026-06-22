/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_schema.pets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      name varchar(120) NOT NULL,
      species varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS pets_owner_id_idx
      ON pet_schema.pets (owner_id);

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_holds_pet_id_fkey') THEN
        ALTER TABLE booking_schema.booking_holds
          ADD CONSTRAINT booking_holds_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pet_schema.pets(id) NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_pet_id_fkey') THEN
        ALTER TABLE booking_schema.appointments
          ADD CONSTRAINT appointments_pet_id_fkey
          FOREIGN KEY (pet_id) REFERENCES pet_schema.pets(id) NOT VALID;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS clinic_schema.employee_location_memberships (
      employee_id uuid NOT NULL REFERENCES identity_schema.users(id),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      role text NOT NULL CHECK (role IN ('CLINIC_RECEPTIONIST', 'CLINIC_ADMIN')),
      active boolean NOT NULL DEFAULT true,
      granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (employee_id, clinic_location_id),
      CHECK ((active = true AND revoked_at IS NULL) OR (active = false AND revoked_at IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS employee_location_memberships_active_idx
      ON clinic_schema.employee_location_memberships (employee_id, clinic_location_id)
      WHERE active = true;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS clinic_schema.employee_location_memberships;
    ALTER TABLE booking_schema.appointments
      DROP CONSTRAINT IF EXISTS appointments_pet_id_fkey;
    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_pet_id_fkey;
    DROP TABLE IF EXISTS pet_schema.pets;
  `);
};
