CREATE SCHEMA IF NOT EXISTS identity_schema;
CREATE SCHEMA IF NOT EXISTS pet_schema;

CREATE TABLE IF NOT EXISTS identity_schema.users (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS pet_schema.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
  name varchar(120) NOT NULL,
  species varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS pets_owner_id_idx ON pet_schema.pets (owner_id);

ALTER TABLE booking_schema.booking_holds
  ADD CONSTRAINT booking_holds_pet_id_fkey
  FOREIGN KEY (pet_id)
  REFERENCES pet_schema.pets(id)
  NOT VALID;
