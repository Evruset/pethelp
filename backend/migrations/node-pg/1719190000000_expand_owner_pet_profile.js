/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE pet_schema.pets
      ADD COLUMN IF NOT EXISTS breed varchar(120),
      ADD COLUMN IF NOT EXISTS birth_date date,
      ADD COLUMN IF NOT EXISTS sex varchar(16),
      ADD COLUMN IF NOT EXISTS weight_kg numeric(6,2),
      ADD COLUMN IF NOT EXISTS sterilized boolean,
      ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS chronic_conditions text[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS vaccination_notes text,
      ADD COLUMN IF NOT EXISTS photo_url text,
      ADD COLUMN IF NOT EXISTS insurance_policy_links jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS profile_version bigint NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_sex_check') THEN
        ALTER TABLE pet_schema.pets
          ADD CONSTRAINT pets_sex_check CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE', 'UNKNOWN'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_weight_kg_check') THEN
        ALTER TABLE pet_schema.pets
          ADD CONSTRAINT pets_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg > 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_insurance_policy_links_array_check') THEN
        ALTER TABLE pet_schema.pets
          ADD CONSTRAINT pets_insurance_policy_links_array_check CHECK (jsonb_typeof(insurance_policy_links) = 'array');
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE pet_schema.pets
      DROP CONSTRAINT IF EXISTS pets_insurance_policy_links_array_check,
      DROP CONSTRAINT IF EXISTS pets_weight_kg_check,
      DROP CONSTRAINT IF EXISTS pets_sex_check,
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS profile_version,
      DROP COLUMN IF EXISTS insurance_policy_links,
      DROP COLUMN IF EXISTS photo_url,
      DROP COLUMN IF EXISTS vaccination_notes,
      DROP COLUMN IF EXISTS chronic_conditions,
      DROP COLUMN IF EXISTS allergies,
      DROP COLUMN IF EXISTS sterilized,
      DROP COLUMN IF EXISTS weight_kg,
      DROP COLUMN IF EXISTS sex,
      DROP COLUMN IF EXISTS birth_date,
      DROP COLUMN IF EXISTS breed;
  `);
};
