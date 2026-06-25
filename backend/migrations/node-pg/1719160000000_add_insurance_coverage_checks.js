/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS insurance_schema;

    CREATE TABLE IF NOT EXISTS insurance_schema.coverage_checks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id),
      partner_code text NOT NULL,
      state text NOT NULL CHECK (state IN ('CONSENT_REQUIRED', 'REQUESTED', 'PROCESSING', 'COVERED', 'NOT_COVERED', 'MANUAL_REVIEW', 'FAILED', 'EXPIRED')),
      consent_version text,
      consented_at timestamptz,
      provider_reference text,
      response_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS coverage_checks_owner_idx
      ON insurance_schema.coverage_checks (owner_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP SCHEMA IF EXISTS insurance_schema CASCADE;');
};
