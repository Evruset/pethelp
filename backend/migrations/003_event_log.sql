CREATE SCHEMA IF NOT EXISTS booking_schema;
CREATE TABLE IF NOT EXISTS booking_schema.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  producer text NOT NULL DEFAULT 'booking-core',
  correlation_id uuid,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  last_error text,
  deduplication_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
