ALTER TABLE booking_schema.outbox_events
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS deduplication_key text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE UNIQUE INDEX IF NOT EXISTS outbox_deduplication_idx ON booking_schema.outbox_events (deduplication_key);
