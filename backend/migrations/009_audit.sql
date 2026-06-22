CREATE SCHEMA IF NOT EXISTS audit_schema;
CREATE TABLE IF NOT EXISTS audit_schema.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  correlation_id uuid,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_aggregate_idx ON audit_schema.audit_log (aggregate_type, aggregate_id, occurred_at DESC);
