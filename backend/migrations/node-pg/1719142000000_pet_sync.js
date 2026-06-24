/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE pet_schema.pets
      ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

    CREATE TABLE IF NOT EXISTS pet_schema.client_mutations (
      mutation_id uuid PRIMARY KEY,
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      device_id uuid NOT NULL,
      device_sequence bigint NOT NULL,
      base_server_version integer NOT NULL,
      payload_schema_version integer NOT NULL,
      changed_fields jsonb NOT NULL,
      client_occurred_at timestamptz NOT NULL,
      state text NOT NULL,
      response_body jsonb NOT NULL DEFAULT '{}'::jsonb,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      UNIQUE (pet_id, device_id, device_sequence)
    );

    CREATE INDEX IF NOT EXISTS client_mutations_pet_device_sequence_idx
      ON pet_schema.client_mutations (pet_id, device_id, device_sequence DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS pet_schema.client_mutations_pet_device_sequence_idx;
    DROP TABLE IF EXISTS pet_schema.client_mutations;
    ALTER TABLE pet_schema.pets
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS version;
  `);
};
