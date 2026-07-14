exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE pet_schema.pets
      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

    CREATE INDEX IF NOT EXISTS pets_owner_active_created_idx
      ON pet_schema.pets (owner_id, created_at, id)
      WHERE archived_at IS NULL;
  `);
};

// Archival is forward-only: removing the column would silently reactivate pets.
exports.down = () => {};
