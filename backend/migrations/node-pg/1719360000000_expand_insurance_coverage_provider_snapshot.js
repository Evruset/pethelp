/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE insurance_schema.coverage_checks
      ADD COLUMN IF NOT EXISTS provider_checked_at timestamptz,
      ADD COLUMN IF NOT EXISTS coverage_valid_until timestamptz,
      ADD COLUMN IF NOT EXISTS claim_draft_json jsonb NOT NULL DEFAULT '{}'::jsonb;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'coverage_checks_claim_draft_json_object_check'
      ) THEN
        ALTER TABLE insurance_schema.coverage_checks
          ADD CONSTRAINT coverage_checks_claim_draft_json_object_check
          CHECK (jsonb_typeof(claim_draft_json) = 'object');
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE insurance_schema.coverage_checks
      DROP CONSTRAINT IF EXISTS coverage_checks_claim_draft_json_object_check,
      DROP COLUMN IF EXISTS claim_draft_json,
      DROP COLUMN IF EXISTS coverage_valid_until,
      DROP COLUMN IF EXISTS provider_checked_at;
  `);
};
