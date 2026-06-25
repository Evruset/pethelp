/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS identity_schema.owner_identities (
      user_id uuid PRIMARY KEY REFERENCES identity_schema.users(id) ON DELETE CASCADE,
      phone_e164 text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
    );

    CREATE TABLE IF NOT EXISTS identity_schema.otp_challenges (
      id uuid PRIMARY KEY,
      phone_e164 text NOT NULL,
      code_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      attempts_remaining integer NOT NULL DEFAULT 5 CHECK (attempts_remaining >= 0 AND attempts_remaining <= 5),
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
    );
    CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx
      ON identity_schema.otp_challenges (phone_e164, created_at DESC);
    CREATE INDEX IF NOT EXISTS otp_challenges_expiry_idx
      ON identity_schema.otp_challenges (expires_at)
      WHERE consumed_at IS NULL;

    CREATE TABLE IF NOT EXISTS identity_schema.owner_sessions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE CASCADE,
      refresh_token_hash text NOT NULL UNIQUE,
      device_name text,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS owner_sessions_active_user_idx
      ON identity_schema.owner_sessions (user_id, expires_at DESC)
      WHERE revoked_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS identity_schema.owner_sessions;
    DROP TABLE IF EXISTS identity_schema.otp_challenges;
    DROP TABLE IF EXISTS identity_schema.owner_identities;
  `);
};
