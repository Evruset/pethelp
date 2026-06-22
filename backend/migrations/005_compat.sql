CREATE TABLE IF NOT EXISTS booking_schema.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
