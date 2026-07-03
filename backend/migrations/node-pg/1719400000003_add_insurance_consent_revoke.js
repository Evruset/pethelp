/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE insurance_schema.insurance_profiles
      ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz,
      ADD COLUMN IF NOT EXISTS consent_revocation_reason text;

    CREATE INDEX IF NOT EXISTS insurance_profiles_active_consent_idx
      ON insurance_schema.insurance_profiles (owner_id, pet_id, created_at DESC)
      WHERE consent_revoked_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS insurance_schema.insurance_profiles_active_consent_idx;

    ALTER TABLE insurance_schema.insurance_profiles
      DROP COLUMN IF EXISTS consent_revocation_reason,
      DROP COLUMN IF EXISTS consent_revoked_at;
  `);
};
