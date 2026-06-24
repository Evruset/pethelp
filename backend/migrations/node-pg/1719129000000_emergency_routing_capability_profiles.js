/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    /*
     * Emergency availability is intentionally modelled as a verified capability
     * profile. A generic clinic location must never appear in the emergency
     * route merely because it is geographically close.
     */
    ALTER TABLE clinic_schema.clinic_locations
      ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
      ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

    ALTER TABLE clinic_schema.clinic_locations
      DROP CONSTRAINT IF EXISTS clinic_locations_latitude_check;
    ALTER TABLE clinic_schema.clinic_locations
      ADD CONSTRAINT clinic_locations_latitude_check
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);

    ALTER TABLE clinic_schema.clinic_locations
      DROP CONSTRAINT IF EXISTS clinic_locations_longitude_check;
    ALTER TABLE clinic_schema.clinic_locations
      ADD CONSTRAINT clinic_locations_longitude_check
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_capability_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL UNIQUE REFERENCES clinic_schema.clinic_locations(id) ON DELETE CASCADE,
      accepts_emergency_now boolean NOT NULL DEFAULT false,
      emergency_status text NOT NULL DEFAULT 'CLOSED',
      status_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      verification_status text NOT NULL DEFAULT 'PENDING',
      verified_at timestamptz,
      valid_until timestamptz NOT NULL,
      capability_version text NOT NULL,
      emergency_contact_phone text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT emergency_capability_profiles_status_check
        CHECK (emergency_status IN ('ACCEPTING_NOW', 'TEMPORARILY_UNAVAILABLE', 'CLOSED')),
      CONSTRAINT emergency_capability_profiles_verification_check
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED')),
      CONSTRAINT emergency_capability_profiles_acceptance_check
        CHECK (accepts_emergency_now = (emergency_status = 'ACCEPTING_NOW')),
      CONSTRAINT emergency_capability_profiles_verified_at_check
        CHECK ((verification_status = 'VERIFIED' AND verified_at IS NOT NULL) OR verification_status <> 'VERIFIED')
    );

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_capabilities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES clinic_schema.emergency_capability_profiles(id) ON DELETE CASCADE,
      capability_code text NOT NULL,
      species text NOT NULL DEFAULT 'ALL',
      available_24x7 boolean NOT NULL DEFAULT false,
      source text NOT NULL,
      evidence_reference text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT emergency_capabilities_species_check
        CHECK (species IN ('ALL', 'DOG', 'CAT', 'OTHER')),
      CONSTRAINT emergency_capabilities_code_check
        CHECK (capability_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
      CONSTRAINT emergency_capabilities_unique_code_per_species
        UNIQUE (profile_id, capability_code, species)
    );

    CREATE INDEX IF NOT EXISTS emergency_capability_profiles_route_idx
      ON clinic_schema.emergency_capability_profiles (emergency_status, verification_status, valid_until, status_updated_at DESC)
      WHERE emergency_status = 'ACCEPTING_NOW' AND verification_status = 'VERIFIED';

    CREATE INDEX IF NOT EXISTS emergency_capabilities_lookup_idx
      ON clinic_schema.emergency_capabilities (profile_id, species, capability_code);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.emergency_capabilities_lookup_idx;
    DROP INDEX IF EXISTS clinic_schema.emergency_capability_profiles_route_idx;
    DROP TABLE IF EXISTS clinic_schema.emergency_capabilities;
    DROP TABLE IF EXISTS clinic_schema.emergency_capability_profiles;

    ALTER TABLE clinic_schema.clinic_locations
      DROP CONSTRAINT IF EXISTS clinic_locations_longitude_check,
      DROP CONSTRAINT IF EXISTS clinic_locations_latitude_check,
      DROP COLUMN IF EXISTS longitude,
      DROP COLUMN IF EXISTS latitude;
  `);
};
