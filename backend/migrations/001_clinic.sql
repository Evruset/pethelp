CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS clinic_schema;

CREATE TABLE IF NOT EXISTS clinic_schema.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  public_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS clinic_schema.clinic_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id),
  address text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS clinic_schema.clinic_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
  code text NOT NULL,
  display_name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (clinic_location_id, code)
);

CREATE TABLE IF NOT EXISTS clinic_schema.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
  service_id uuid REFERENCES clinic_schema.clinic_services(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count integer NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  held_count integer NOT NULL DEFAULT 0 CHECK (held_count >= 0),
  state text NOT NULL DEFAULT 'OPEN',
  source text NOT NULL DEFAULT 'MANUAL',
  external_slot_id text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_at > starts_at),
  CHECK (booked_count + held_count <= capacity),
  UNIQUE (source, external_slot_id)
);

CREATE INDEX IF NOT EXISTS appointment_slots_location_time_idx
ON clinic_schema.appointment_slots (clinic_location_id, starts_at) WHERE state = 'OPEN';
