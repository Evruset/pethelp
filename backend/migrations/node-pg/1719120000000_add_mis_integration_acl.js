/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinics ADD COLUMN IF NOT EXISTS mis_type text;
    ALTER TABLE pet_schema.pets ADD COLUMN IF NOT EXISTS external_patient_id text;
    ALTER TABLE booking_schema.booking_holds
      ADD COLUMN IF NOT EXISTS external_hold_id text,
      ADD COLUMN IF NOT EXISTS mis_last_error text,
      ADD COLUMN IF NOT EXISTS mis_processed_at timestamptz;
    ALTER TABLE booking_schema.outbox_events ADD COLUMN IF NOT EXISTS processed_at timestamptz;

    CREATE INDEX IF NOT EXISTS pets_external_patient_id_idx
      ON pet_schema.pets (external_patient_id)
      WHERE external_patient_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS outbox_mis_reservation_pending_idx
      ON booking_schema.outbox_events (available_at, created_at)
      WHERE event_type = 'mis.reservation.requested.v1'
        AND status = 'PENDING'
        AND processed_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.outbox_mis_reservation_pending_idx;
    ALTER TABLE booking_schema.outbox_events DROP COLUMN IF EXISTS processed_at;
    ALTER TABLE booking_schema.booking_holds
      DROP COLUMN IF EXISTS mis_processed_at,
      DROP COLUMN IF EXISTS mis_last_error,
      DROP COLUMN IF EXISTS external_hold_id;
    DROP INDEX IF EXISTS pet_schema.pets_external_patient_id_idx;
    ALTER TABLE pet_schema.pets DROP COLUMN IF EXISTS external_patient_id;
    ALTER TABLE clinic_schema.clinics DROP COLUMN IF EXISTS mis_type;
  `);
};
