ALTER TABLE booking_schema.outbox_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
