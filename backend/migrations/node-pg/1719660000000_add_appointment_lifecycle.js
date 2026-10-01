exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.appointments
      ADD COLUMN lifecycle_state text,
      ADD COLUMN cancelled_by text,
      ADD COLUMN cancelled_by_actor_id uuid,
      ADD COLUMN cancelled_at timestamptz,
      ADD COLUMN late_cancellation boolean,
      ADD COLUMN cancellation_reason_code text,
      ADD COLUMN cancellation_reason_text text,
      ADD COLUMN no_show_at timestamptz,
      ADD COLUMN no_show_by_actor_id uuid;

    UPDATE booking_schema.appointments
    SET lifecycle_state = CASE
      WHEN status IN ('CONFIRMED', 'CLINIC_CONFIRMED') THEN 'CONFIRMED'
      WHEN status = 'CANCELLED' THEN 'CANCELLED_BY_USER'
      WHEN status = 'CLINIC_CANCELLED' THEN 'CANCELLED_BY_CLINIC'
      WHEN status = 'NO_SHOW' THEN 'NO_SHOW'
      ELSE NULL
    END;

    ALTER TABLE booking_schema.appointments
      ADD CONSTRAINT appointments_lifecycle_state_check CHECK (
        lifecycle_state IS NULL OR lifecycle_state IN (
          'CONFIRMED','CANCELLED_BY_USER','CANCELLED_BY_CLINIC','RESCHEDULE_PROPOSED','NO_SHOW'
        )
      ),
      ADD CONSTRAINT appointments_cancelled_by_check CHECK (
        cancelled_by IS NULL OR cancelled_by IN ('OWNER','CLINIC')
      );

    ALTER TABLE booking_schema.alternative_swap_groups
      ADD COLUMN appointment_id uuid REFERENCES booking_schema.appointments(id);
    CREATE INDEX appointment_lifecycle_state_idx
      ON booking_schema.appointments (clinic_location_id, lifecycle_state, updated_at DESC);
    CREATE INDEX alternative_swap_groups_appointment_idx
      ON booking_schema.alternative_swap_groups (appointment_id, created_at DESC)
      WHERE appointment_id IS NOT NULL;
  `);
};

exports.down = () => {
  throw new Error('IRREVERSIBLE_APPOINTMENT_LIFECYCLE_HISTORY');
};
