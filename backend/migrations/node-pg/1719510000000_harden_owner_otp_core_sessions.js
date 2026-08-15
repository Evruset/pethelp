/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE identity_schema.otp_challenges
      ADD COLUMN IF NOT EXISTS resend_available_at timestamptz,
      ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
      ADD COLUMN IF NOT EXISTS generation integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS delivery_attempt_id uuid,
      ADD COLUMN IF NOT EXISTS delivery_outcome text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

    UPDATE identity_schema.otp_challenges
    SET resend_available_at = created_at + interval '60 seconds'
    WHERE resend_available_at IS NULL;

    ALTER TABLE identity_schema.otp_challenges
      ALTER COLUMN resend_available_at SET NOT NULL;

    ALTER TABLE identity_schema.otp_challenges
      ADD CONSTRAINT otp_challenges_generation_check CHECK (generation > 0),
      ADD CONSTRAINT otp_challenges_delivery_outcome_check CHECK (
        delivery_outcome IS NULL OR delivery_outcome IN (
          'ACCEPTED','PROVIDER_REJECTED','PROVIDER_UNAVAILABLE',
          'PROVIDER_RETRYABLE_FAILURE','PROVIDER_FINAL_FAILURE',
          'PROVIDER_TIMEOUT','OUTCOME_UNKNOWN'
        )
      );

    CREATE UNIQUE INDEX IF NOT EXISTS otp_challenges_delivery_attempt_uq
      ON identity_schema.otp_challenges (delivery_attempt_id)
      WHERE delivery_attempt_id IS NOT NULL;

    ALTER TABLE identity_schema.owner_sessions
      ADD COLUMN IF NOT EXISTS session_token_hash text;
    CREATE UNIQUE INDEX IF NOT EXISTS owner_sessions_session_token_hash_uq
      ON identity_schema.owner_sessions (session_token_hash)
      WHERE session_token_hash IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS identity_schema.owner_sessions_session_token_hash_uq;
    ALTER TABLE identity_schema.owner_sessions DROP COLUMN IF EXISTS session_token_hash;
    DROP INDEX IF EXISTS identity_schema.otp_challenges_delivery_attempt_uq;
    ALTER TABLE identity_schema.otp_challenges
      DROP CONSTRAINT IF EXISTS otp_challenges_delivery_outcome_check,
      DROP CONSTRAINT IF EXISTS otp_challenges_generation_check,
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS delivery_outcome,
      DROP COLUMN IF EXISTS delivery_attempt_id,
      DROP COLUMN IF EXISTS generation,
      DROP COLUMN IF EXISTS superseded_at,
      DROP COLUMN IF EXISTS resend_available_at;
  `);
};
