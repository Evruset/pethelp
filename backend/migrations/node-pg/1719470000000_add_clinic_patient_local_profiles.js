/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clinic_schema.clinic_patient_local_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE NO ACTION,
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id) ON DELETE NO ACTION,
      patient_id uuid NOT NULL REFERENCES pet_schema.pets(id) ON DELETE NO ACTION,
      alias text,
      aggregate_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT clinic_patient_local_profiles_scope_key
        UNIQUE (clinic_id, clinic_location_id, patient_id),
      CONSTRAINT clinic_patient_local_profiles_association_fkey
        FOREIGN KEY (clinic_id, clinic_location_id, patient_id)
        REFERENCES clinic_schema.clinic_patient_associations
          (clinic_id, clinic_location_id, pet_id)
        ON DELETE NO ACTION,
      CONSTRAINT clinic_patient_local_profiles_alias_check
        CHECK (
          alias IS NULL OR (
            btrim(alias) <> ''
            AND char_length(alias) <= 80
            AND alias !~ '[[:cntrl:]]'
          )
        ),
      CONSTRAINT clinic_patient_local_profiles_version_check
        CHECK (aggregate_version > 0),
      CONSTRAINT clinic_patient_local_profiles_dates_check
        CHECK (updated_at >= created_at)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS clinic_schema.clinic_patient_local_profiles;');
};
