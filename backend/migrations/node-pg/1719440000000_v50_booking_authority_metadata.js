/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinic_services
      ADD COLUMN IF NOT EXISTS supported_species text[];
    ALTER TABLE catalog_schema.doctors
      ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT true;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE catalog_schema.doctors
      DROP COLUMN IF EXISTS public_booking_enabled,
      DROP COLUMN IF EXISTS active;
    ALTER TABLE clinic_schema.clinic_services
      DROP COLUMN IF EXISTS supported_species;
  `);
};
