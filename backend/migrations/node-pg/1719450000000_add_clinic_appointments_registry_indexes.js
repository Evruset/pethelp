/* eslint-disable */
exports.shorthands = undefined;

/*
 * node-pg-migrate is invoked with --single-transaction in this repository, so
 * CREATE INDEX CONCURRENTLY cannot be used here. These indexes take the normal
 * PostgreSQL CREATE INDEX write lock while they are built. Apply the migration
 * in a maintenance window sized for appointment_slots and appointments.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS appointment_slots_registry_location_starts_idx
      ON clinic_schema.appointment_slots (clinic_location_id, starts_at, id)
      INCLUDE (ends_at, service_id);

    CREATE INDEX IF NOT EXISTS appointments_registry_slot_id_idx
      ON booking_schema.appointments (slot_id, id)
      INCLUDE (clinic_location_id, created_at, status, version, pet_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.appointments_registry_slot_id_idx;
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_registry_location_starts_idx;
  `);
};
