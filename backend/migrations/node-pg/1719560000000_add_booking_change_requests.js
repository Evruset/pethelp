/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_change_request_context_key
      UNIQUE (id, owner_id, slot_id);

    ALTER TABLE clinic_schema.appointment_slots
      ADD CONSTRAINT appointment_slots_change_request_context_key
      UNIQUE (id, clinic_location_id);

    ALTER TABLE booking_schema.appointments
      ADD CONSTRAINT appointments_change_request_context_key
      UNIQUE (id, hold_id, owner_id, clinic_location_id, slot_id);

    CREATE TABLE booking_schema.booking_change_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_type text NOT NULL,
      status text NOT NULL DEFAULT 'OPEN',
      booking_hold_id uuid NOT NULL,
      appointment_id uuid,
      owner_id uuid NOT NULL,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      slot_id uuid NOT NULL,
      idempotency_key uuid NOT NULL,
      correlation_id uuid NOT NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      terminal_at timestamptz,
      CONSTRAINT booking_change_requests_type_check
        CHECK (request_type IN ('CANCEL', 'RESCHEDULE')),
      CONSTRAINT booking_change_requests_status_check
        CHECK (status IN ('OPEN', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
      CONSTRAINT booking_change_requests_version_check CHECK (version > 0),
      CONSTRAINT booking_change_requests_time_order_check
        CHECK (state_changed_at >= created_at AND updated_at >= created_at),
      CONSTRAINT booking_change_requests_terminal_check CHECK (
        (status IN ('OPEN', 'PROCESSING') AND terminal_at IS NULL)
        OR
        (status IN ('COMPLETED', 'REJECTED', 'CANCELLED') AND terminal_at IS NOT NULL AND terminal_at >= created_at)
      ),
      CONSTRAINT booking_change_requests_hold_owner_slot_fkey
        FOREIGN KEY (booking_hold_id, owner_id, slot_id)
        REFERENCES booking_schema.booking_holds (id, owner_id, slot_id) ON DELETE RESTRICT,
      CONSTRAINT booking_change_requests_slot_location_fkey
        FOREIGN KEY (slot_id, location_id)
        REFERENCES clinic_schema.appointment_slots (id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT booking_change_requests_location_clinic_fkey
        FOREIGN KEY (location_id, clinic_id)
        REFERENCES clinic_schema.clinic_locations (id, clinic_id) ON DELETE RESTRICT,
      CONSTRAINT booking_change_requests_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, location_id, slot_id)
        REFERENCES booking_schema.appointments (id, hold_id, owner_id, clinic_location_id, slot_id) ON DELETE RESTRICT,
      CONSTRAINT booking_change_requests_owner_operation_idempotency_key
        UNIQUE (owner_id, request_type, idempotency_key)
    );

    CREATE UNIQUE INDEX booking_change_requests_one_active_per_booking_idx
      ON booking_schema.booking_change_requests (booking_hold_id)
      WHERE status IN ('OPEN', 'PROCESSING');

    CREATE INDEX booking_change_requests_owner_read_idx
      ON booking_schema.booking_change_requests (owner_id, booking_hold_id, created_at DESC, id DESC);

    CREATE INDEX booking_change_requests_operations_queue_idx
      ON booking_schema.booking_change_requests (status, created_at ASC, id ASC)
      WHERE status IN ('OPEN', 'PROCESSING');

    CREATE INDEX booking_change_requests_location_queue_idx
      ON booking_schema.booking_change_requests (clinic_id, location_id, status, created_at ASC, id ASC)
      WHERE status IN ('OPEN', 'PROCESSING');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS booking_schema.booking_change_requests;
    ALTER TABLE booking_schema.appointments
      DROP CONSTRAINT IF EXISTS appointments_change_request_context_key;
    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT IF EXISTS appointment_slots_change_request_context_key;
    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_change_request_context_key;
  `);
};
