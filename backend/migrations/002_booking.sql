CREATE SCHEMA IF NOT EXISTS booking_schema;

CREATE TABLE IF NOT EXISTS booking_schema.booking_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES clinic_schema.appointment_slots(id),
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('MANUAL_CONFIRM_PENDING','CONFIRMED','EXPIRED','RELEASED','MIS_RESERVATION_PENDING','MIS_HELD','PAYMENT_PENDING','PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING','MIS_BOOKING_FAILED')),
  expires_at timestamptz NOT NULL,
  state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS booking_holds_expirable_idx ON booking_schema.booking_holds (slot_id, expires_at) WHERE state = 'MANUAL_CONFIRM_PENDING';

CREATE TABLE IF NOT EXISTS booking_schema.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL UNIQUE REFERENCES booking_schema.booking_holds(id),
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
  slot_id uuid NOT NULL REFERENCES clinic_schema.appointment_slots(id),
  status text NOT NULL DEFAULT 'CONFIRMED',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS booking_schema.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES booking_schema.appointments(id),
  hold_id uuid REFERENCES booking_schema.booking_holds(id),
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  correlation_id uuid,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS booking_schema.idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  idempotency_key uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('PROCESSING','COMPLETED')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (scope, idempotency_key)
);
