/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.booking_change_requests
      DROP CONSTRAINT booking_change_requests_hold_owner_slot_fkey,
      ADD CONSTRAINT booking_change_requests_hold_owner_slot_fkey
        FOREIGN KEY (booking_hold_id, owner_id, slot_id)
        REFERENCES booking_schema.booking_holds (id, owner_id, slot_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY IMMEDIATE;

    ALTER TABLE booking_schema.booking_change_requests
      DROP CONSTRAINT booking_change_requests_appointment_context_fkey,
      ADD CONSTRAINT booking_change_requests_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, location_id, slot_id)
        REFERENCES booking_schema.appointments (id, hold_id, owner_id, clinic_location_id, slot_id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY IMMEDIATE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.booking_change_requests
      DROP CONSTRAINT booking_change_requests_hold_owner_slot_fkey,
      ADD CONSTRAINT booking_change_requests_hold_owner_slot_fkey
        FOREIGN KEY (booking_hold_id, owner_id, slot_id)
        REFERENCES booking_schema.booking_holds (id, owner_id, slot_id)
        ON DELETE RESTRICT;

    ALTER TABLE booking_schema.booking_change_requests
      DROP CONSTRAINT booking_change_requests_appointment_context_fkey,
      ADD CONSTRAINT booking_change_requests_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, location_id, slot_id)
        REFERENCES booking_schema.appointments (id, hold_id, owner_id, clinic_location_id, slot_id)
        ON DELETE RESTRICT;
  `);
};
