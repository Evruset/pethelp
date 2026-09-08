/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinic_patient_local_profiles
      ADD COLUMN administrative_reference text,
      ADD COLUMN administrative_reference_key text,
      ADD CONSTRAINT clinic_patient_local_profiles_reference_pair_check
        CHECK ((administrative_reference IS NULL) = (administrative_reference_key IS NULL)),
      ADD CONSTRAINT clinic_patient_local_profiles_reference_format_check
        CHECK (
          administrative_reference IS NULL OR (
            btrim(administrative_reference) <> ''
            AND char_length(administrative_reference) <= 40
            AND administrative_reference !~ '[[:cntrl:]]'
          )
        );

    CREATE UNIQUE INDEX clinic_patient_local_profiles_reference_location_key
      ON clinic_schema.clinic_patient_local_profiles
        (clinic_id, clinic_location_id, administrative_reference_key)
      WHERE administrative_reference_key IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_local_profiles_reference_location_key;
    ALTER TABLE clinic_schema.clinic_patient_local_profiles
      DROP CONSTRAINT IF EXISTS clinic_patient_local_profiles_reference_format_check,
      DROP CONSTRAINT IF EXISTS clinic_patient_local_profiles_reference_pair_check,
      DROP COLUMN IF EXISTS administrative_reference_key,
      DROP COLUMN IF EXISTS administrative_reference;
  `);
};
