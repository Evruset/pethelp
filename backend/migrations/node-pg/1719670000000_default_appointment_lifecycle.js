exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE booking_schema.appointments ALTER COLUMN lifecycle_state SET DEFAULT 'CONFIRMED';`);
};
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE booking_schema.appointments ALTER COLUMN lifecycle_state DROP DEFAULT;`);
};
