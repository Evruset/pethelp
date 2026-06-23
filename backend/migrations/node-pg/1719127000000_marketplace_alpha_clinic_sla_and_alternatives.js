/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    /*
     * Slots are owned by clinic_schema in the current VetHelp bounded-context
     * model. booking_schema owns holds, appointments and the outbox.
     */
    ALTER TABLE clinic_schema.appointment_slots
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'AVAILABLE',
      ADD COLUMN IF NOT EXISTS last_freshness_sync timestamptz NOT NULL DEFAULT clock_timestamp(),
      ADD COLUMN IF NOT EXISTS integration_mode text NOT NULL DEFAULT 'LEVEL_C';

    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT IF EXISTS appointment_slots_status_check;
    ALTER TABLE clinic_schema.appointment_slots
      ADD CONSTRAINT appointment_slots_status_check
      CHECK (status IN ('AVAILABLE', 'LOCKED_BY_HOLD', 'BOOKED'));

    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT IF EXISTS appointment_slots_integration_mode_check;
    ALTER TABLE clinic_schema.appointment_slots
      ADD CONSTRAINT appointment_slots_integration_mode_check
      CHECK (integration_mode IN ('LEVEL_A', 'LEVEL_B', 'LEVEL_C'));

    UPDATE clinic_schema.appointment_slots
    SET status = CASE
      WHEN booked_count >= capacity THEN 'BOOKED'
      WHEN held_count > 0 THEN 'LOCKED_BY_HOLD'
      ELSE 'AVAILABLE'
    END,
    last_freshness_sync = COALESCE(last_freshness_sync, clock_timestamp()),
    integration_mode = COALESCE(integration_mode, 'LEVEL_C');

    ALTER TABLE booking_schema.booking_holds
      ADD COLUMN IF NOT EXISTS confirmation_sla_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS alternative_slot_id uuid REFERENCES clinic_schema.appointment_slots(id),
      ADD COLUMN IF NOT EXISTS alternative_expires_at timestamptz;

    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_state_check;
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_state_check
      CHECK (state IN (
        'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'CONFIRMED',
        'EXPIRED', 'RELEASED', 'SLA_BREACHED',
        'MIS_RESERVATION_PENDING', 'MIS_HELD', 'PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING',
        'MIS_BOOKING_FAILED'
      ));

    CREATE INDEX IF NOT EXISTS booking_holds_manual_confirmation_sla_idx
      ON booking_schema.booking_holds (confirmation_sla_expires_at, id)
      WHERE state = 'MANUAL_CONFIRM_PENDING' AND confirmation_sla_expires_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS booking_holds_alternative_expiry_idx
      ON booking_schema.booking_holds (alternative_expires_at, id)
      WHERE state = 'ALTERNATIVE_PENDING' AND alternative_expires_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS appointment_slots_marketplace_status_idx
      ON clinic_schema.appointment_slots (clinic_location_id, status, starts_at)
      WHERE state = 'OPEN';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_marketplace_status_idx;
    DROP INDEX IF EXISTS booking_schema.booking_holds_alternative_expiry_idx;
    DROP INDEX IF EXISTS booking_schema.booking_holds_manual_confirmation_sla_idx;

    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_state_check;
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_state_check
      CHECK (state IN (
        'MANUAL_CONFIRM_PENDING','CONFIRMED','EXPIRED','RELEASED',
        'MIS_RESERVATION_PENDING','MIS_HELD','PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING',
        'MIS_BOOKING_FAILED'
      ));

    ALTER TABLE booking_schema.booking_holds
      DROP COLUMN IF EXISTS alternative_expires_at,
      DROP COLUMN IF EXISTS alternative_slot_id,
      DROP COLUMN IF EXISTS confirmation_sla_expires_at;

    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT IF EXISTS appointment_slots_integration_mode_check,
      DROP CONSTRAINT IF EXISTS appointment_slots_status_check,
      DROP COLUMN IF EXISTS integration_mode,
      DROP COLUMN IF EXISTS last_freshness_sync,
      DROP COLUMN IF EXISTS status;
  `);
};
