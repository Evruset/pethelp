/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE catalog_schema.specialty_services (
      service_id uuid PRIMARY KEY
        REFERENCES clinic_schema.clinic_services(id) ON DELETE RESTRICT,
      specialty_id uuid NOT NULL
        REFERENCES catalog_schema.specialties(id) ON DELETE RESTRICT,
      active boolean NOT NULL DEFAULT true,
      created_by uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      version integer NOT NULL DEFAULT 1,
      CONSTRAINT specialty_services_version_check CHECK (version > 0)
    );
    CREATE INDEX specialty_services_specialty_active_idx
      ON catalog_schema.specialty_services(specialty_id, service_id)
      WHERE active;

    COMMENT ON TABLE catalog_schema.specialty_services IS
      'Explicit authority assigning one global discovery specialty to an exact clinic service. Missing rows are UNKNOWN and fail closed; legacy services are intentionally not inferred or backfilled.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS catalog_schema.specialty_services;`);
};
