ALTER TABLE booking_schema.outbox_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS producer text NOT NULL DEFAULT 'booking-core',
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS aggregate_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS aggregate_id uuid,
  ADD COLUMN IF NOT EXISTS aggregate_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payload_json jsonb NOT NULL DEFAULT '{}'::jsonb;
