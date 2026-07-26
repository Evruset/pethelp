/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE public.shared_rate_limit_windows (
      id bigserial PRIMARY KEY,
      namespace varchar(64) NOT NULL,
      actor_id uuid NOT NULL,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      window_seconds integer NOT NULL,
      window_started_at timestamptz NOT NULL,
      window_ends_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      hit_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT shared_rate_limit_windows_namespace_check
        CHECK (namespace ~ '^[a-z][a-z0-9._-]{0,63}$'),
      CONSTRAINT shared_rate_limit_windows_window_seconds_check
        CHECK (window_seconds > 0 AND window_seconds <= 3600),
      CONSTRAINT shared_rate_limit_windows_count_check
        CHECK (hit_count >= 0),
      CONSTRAINT shared_rate_limit_windows_boundaries_check
        CHECK (
          window_ends_at > window_started_at
          AND expires_at >= window_ends_at
          AND expires_at <= window_started_at + interval '65 minutes'
        ),
      CONSTRAINT shared_rate_limit_windows_identity_key
        UNIQUE (
          namespace,
          actor_id,
          clinic_id,
          location_id,
          window_seconds,
          window_started_at
        )
    );

    CREATE INDEX shared_rate_limit_windows_expires_at_id_idx
      ON public.shared_rate_limit_windows (expires_at, id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS public.shared_rate_limit_windows;
  `);
};
