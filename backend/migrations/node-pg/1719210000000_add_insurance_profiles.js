/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS insurance_schema;

    CREATE TABLE IF NOT EXISTS insurance_schema.insurance_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id),
      insurer_code text NOT NULL,
      policy_reference_hash text NOT NULL,
      policy_reference_masked text NOT NULL,
      pet_relation text NOT NULL,
      valid_from date,
      valid_until date,
      verification_state text NOT NULL DEFAULT 'PENDING',
      consent_version text NOT NULL,
      consented_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      provider_data_masked jsonb NOT NULL DEFAULT '{}'::jsonb,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT insurance_profiles_relation_check
        CHECK (pet_relation IN ('POLICY_HOLDER_PET', 'DEPENDENT_PET', 'UNKNOWN')),
      CONSTRAINT insurance_profiles_verification_check
        CHECK (verification_state IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
      CONSTRAINT insurance_profiles_validity_check
        CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until),
      CONSTRAINT insurance_profiles_masked_payload_check
        CHECK (jsonb_typeof(provider_data_masked) = 'object')
    );

    CREATE UNIQUE INDEX IF NOT EXISTS insurance_profiles_owner_policy_uq
      ON insurance_schema.insurance_profiles (owner_id, insurer_code, policy_reference_hash);

    CREATE INDEX IF NOT EXISTS insurance_profiles_owner_pet_idx
      ON insurance_schema.insurance_profiles (owner_id, pet_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS insurance_schema.insurance_profiles_owner_pet_idx;
    DROP INDEX IF EXISTS insurance_schema.insurance_profiles_owner_policy_uq;
    DROP TABLE IF EXISTS insurance_schema.insurance_profiles;
  `);
};
