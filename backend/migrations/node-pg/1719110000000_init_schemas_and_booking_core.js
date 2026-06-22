/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE SCHEMA IF NOT EXISTS identity_schema;
    CREATE SCHEMA IF NOT EXISTS clinic_schema;
    CREATE SCHEMA IF NOT EXISTS booking_schema;
    CREATE SCHEMA IF NOT EXISTS audit_schema;
    CREATE SCHEMA IF NOT EXISTS pet_schema;

    CREATE TABLE IF NOT EXISTS identity_schema.users (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

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
      ON clinic_schema.appointment_slots (clinic_location_id, starts_at)
      WHERE state = 'OPEN';

    CREATE TABLE IF NOT EXISTS booking_schema.booking_holds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slot_id uuid NOT NULL REFERENCES clinic_schema.appointment_slots(id),
      owner_id uuid NOT NULL,
      pet_id uuid NOT NULL,
      state text NOT NULL CHECK (state IN (
        'MANUAL_CONFIRM_PENDING','CONFIRMED','EXPIRED','RELEASED',
        'MIS_RESERVATION_PENDING','MIS_HELD','PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING',
        'MIS_BOOKING_FAILED'
      )),
      expires_at timestamptz NOT NULL,
      state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS booking_holds_expirable_idx
      ON booking_schema.booking_holds (slot_id, expires_at)
      WHERE state = 'MANUAL_CONFIRM_PENDING';

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

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_holds_owner_id_fkey') THEN
        ALTER TABLE booking_schema.booking_holds
          ADD CONSTRAINT booking_holds_owner_id_fkey
          FOREIGN KEY (owner_id) REFERENCES identity_schema.users(id) NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_owner_id_fkey') THEN
        ALTER TABLE booking_schema.appointments
          ADD CONSTRAINT appointments_owner_id_fkey
          FOREIGN KEY (owner_id) REFERENCES identity_schema.users(id) NOT VALID;
      END IF;
    END $$;

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

    CREATE TABLE IF NOT EXISTS booking_schema.outbox_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL,
      schema_version integer NOT NULL DEFAULT 1,
      producer text NOT NULL DEFAULT 'booking-core',
      correlation_id uuid,
      aggregate_type text NOT NULL,
      aggregate_id uuid,
      aggregate_version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'PENDING',
      available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      lease_until timestamptz,
      attempts integer NOT NULL DEFAULT 0,
      published_at timestamptz,
      last_error text,
      deduplication_key text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS outbox_deduplication_idx
      ON booking_schema.outbox_events (deduplication_key);

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
    CREATE INDEX IF NOT EXISTS audit_log_aggregate_idx
      ON audit_schema.audit_log (aggregate_type, aggregate_id, occurred_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP SCHEMA IF EXISTS audit_schema CASCADE;
    DROP SCHEMA IF EXISTS booking_schema CASCADE;
    DROP SCHEMA IF EXISTS clinic_schema CASCADE;
    DROP SCHEMA IF EXISTS pet_schema CASCADE;
    DROP SCHEMA IF EXISTS identity_schema CASCADE;
  `);
};
