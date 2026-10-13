/* Native scheduling inventory only; no change to Booking authority or existing slots. */
exports.shorthands = undefined;
exports.up = (pgm) => pgm.sql(`
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE clinic_schema.clinic_staff ADD CONSTRAINT clinic_staff_shift_location_key UNIQUE(id,clinic_location_id);
  ALTER TABLE catalog_schema.doctors ADD CONSTRAINT doctors_shift_location_key UNIQUE(id,clinic_location_id);
  CREATE TABLE clinic_schema.doctor_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
    staff_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'PUBLISHED' CHECK(status IN ('PUBLISHED','CANCELLED')),
    source text NOT NULL DEFAULT 'MANUAL' CHECK(length(source) BETWEEN 1 AND 80),
    external_shift_id text CHECK(length(external_shift_id) BETWEEN 1 AND 160),
    created_by uuid REFERENCES identity_schema.users(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '24 hours'),
    FOREIGN KEY(staff_id,clinic_location_id) REFERENCES clinic_schema.clinic_staff(id,clinic_location_id),
    FOREIGN KEY(doctor_id,clinic_location_id) REFERENCES catalog_schema.doctors(id,clinic_location_id),
    EXCLUDE USING gist(doctor_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status='PUBLISHED'),
    EXCLUDE USING gist(staff_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status='PUBLISHED')
  );
  CREATE INDEX doctor_shifts_location_time_idx ON clinic_schema.doctor_shifts(clinic_location_id,starts_at,ends_at);
`);
exports.down = (pgm) => pgm.sql(`
  DO $$ BEGIN IF EXISTS(SELECT 1 FROM clinic_schema.doctor_shifts) THEN
    RAISE EXCEPTION 'Retain populated DoctorShift inventory; roll back application consumers instead';
  END IF; END $$;
  DROP TABLE clinic_schema.doctor_shifts;
  ALTER TABLE catalog_schema.doctors DROP CONSTRAINT doctors_shift_location_key;
  ALTER TABLE clinic_schema.clinic_staff DROP CONSTRAINT clinic_staff_shift_location_key;
  -- btree_gist may be shared; do not remove it during application rollback.
`);
