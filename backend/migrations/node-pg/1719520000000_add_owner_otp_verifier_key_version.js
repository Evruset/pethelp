/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE identity_schema.otp_challenges
      ADD COLUMN IF NOT EXISTS verifier_key_version text NOT NULL DEFAULT 'v1';
    ALTER TABLE identity_schema.otp_challenges
      ADD CONSTRAINT otp_challenges_verifier_key_version_check
      CHECK (verifier_key_version ~ '^v[1-9][0-9]{0,3}$');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE identity_schema.otp_challenges
      DROP CONSTRAINT IF EXISTS otp_challenges_verifier_key_version_check,
      DROP COLUMN IF EXISTS verifier_key_version;
  `);
};
