/* eslint-disable */
exports.shorthands = undefined;
exports.up = (pgm) => pgm.sql(`
  CREATE TABLE identity_schema.otp_rate_limit_attempts (
    id bigserial PRIMARY KEY, phone_identity char(64) NOT NULL, ip_identity char(64) NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '25 hours'),
    CONSTRAINT otp_rate_limit_attempts_phone_identity_check CHECK (phone_identity ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_rate_limit_attempts_ip_identity_check CHECK (ip_identity ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_rate_limit_attempts_expiry_check CHECK (expires_at > attempted_at)
  );
  CREATE INDEX otp_rate_limit_attempts_phone_time_idx ON identity_schema.otp_rate_limit_attempts (phone_identity, attempted_at DESC);
  CREATE INDEX otp_rate_limit_attempts_ip_time_idx ON identity_schema.otp_rate_limit_attempts (ip_identity, attempted_at DESC);
  CREATE INDEX otp_rate_limit_attempts_expiry_idx ON identity_schema.otp_rate_limit_attempts (expires_at, id);
  CREATE TABLE identity_schema.otp_rate_limit_blocks (
    dimension varchar(8) NOT NULL, identity_hash char(64) NOT NULL, blocked_until timestamptz NOT NULL,
    violation_count integer NOT NULL, last_violation_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (dimension, identity_hash),
    CONSTRAINT otp_rate_limit_blocks_dimension_check CHECK (dimension IN ('PHONE', 'IP')),
    CONSTRAINT otp_rate_limit_blocks_identity_check CHECK (identity_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_rate_limit_blocks_violation_check CHECK (violation_count > 0),
    CONSTRAINT otp_rate_limit_blocks_expiry_check CHECK (expires_at >= blocked_until)
  );
  CREATE INDEX otp_rate_limit_blocks_expiry_idx ON identity_schema.otp_rate_limit_blocks (expires_at, dimension, identity_hash);
`);
exports.down = (pgm) => pgm.sql(`DROP TABLE IF EXISTS identity_schema.otp_rate_limit_blocks; DROP TABLE IF EXISTS identity_schema.otp_rate_limit_attempts;`);
