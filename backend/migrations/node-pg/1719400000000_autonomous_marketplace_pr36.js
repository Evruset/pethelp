/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA IF NOT EXISTS catalog_schema;

    CREATE TABLE IF NOT EXISTS catalog_schema.specialties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(160) NOT NULL,
      code varchar(80) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    INSERT INTO catalog_schema.specialties (name, code)
    VALUES
      ('Терапевт', 'THERAPIST'),
      ('Хирург', 'SURGEON'),
      ('Дерматолог', 'DERMATOLOGIST'),
      ('Кардиолог', 'CARDIOLOGIST'),
      ('Гастроэнтеролог', 'GASTROENTEROLOGIST')
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name;

    CREATE TABLE IF NOT EXISTS catalog_schema.doctors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      full_name varchar(240) NOT NULL,
      specialty_id uuid NOT NULL REFERENCES catalog_schema.specialties(id),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS doctors_location_specialty_idx
      ON catalog_schema.doctors (clinic_location_id, specialty_id, full_name);

    ALTER TABLE clinic_schema.appointment_slots
      ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES catalog_schema.doctors(id),
      ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES catalog_schema.specialties(id);
    CREATE INDEX IF NOT EXISTS appointment_slots_specialty_search_idx
      ON clinic_schema.appointment_slots (specialty_id, starts_at)
      WHERE state = 'OPEN';
    CREATE INDEX IF NOT EXISTS appointment_slots_doctor_search_idx
      ON clinic_schema.appointment_slots (doctor_id, starts_at)
      WHERE state = 'OPEN';

    ALTER TABLE pet_schema.pets
      ADD COLUMN IF NOT EXISTS age_months integer,
      ADD COLUMN IF NOT EXISTS gender varchar(16),
      ADD COLUMN IF NOT EXISTS is_sterilized boolean,
      ADD COLUMN IF NOT EXISTS chip_number varchar(80),
      ADD COLUMN IF NOT EXISTS medical_history_ocr jsonb;
    ALTER TABLE pet_schema.pets
      DROP CONSTRAINT IF EXISTS pets_age_months_check;
    ALTER TABLE pet_schema.pets
      ADD CONSTRAINT pets_age_months_check CHECK (age_months IS NULL OR age_months >= 0);
    ALTER TABLE pet_schema.pets
      DROP CONSTRAINT IF EXISTS pets_gender_check;
    ALTER TABLE pet_schema.pets
      ADD CONSTRAINT pets_gender_check CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
    UPDATE pet_schema.pets
    SET gender = CASE WHEN sex IN ('MALE', 'FEMALE') THEN sex ELSE gender END,
        is_sterilized = COALESCE(is_sterilized, sterilized)
    WHERE gender IS NULL OR is_sterilized IS NULL;

    CREATE TABLE IF NOT EXISTS pet_schema.pet_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id) ON DELETE CASCADE,
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      file_url text NOT NULL,
      doc_type varchar(24) NOT NULL CHECK (doc_type IN ('PASSPORT', 'HISTORY')),
      status varchar(24) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'PROCESSED', 'FAILED')),
      ocr_result jsonb,
      error_message text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      processed_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS pet_documents_processing_idx
      ON pet_schema.pet_documents (created_at, id)
      WHERE status = 'PROCESSING';
    CREATE INDEX IF NOT EXISTS pet_documents_pet_idx
      ON pet_schema.pet_documents (pet_id, created_at DESC);

    ALTER TABLE booking_schema.booking_holds
      ADD COLUMN IF NOT EXISTS clinical_summary text;
    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_state_check;
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_state_check
      CHECK (state IN (
        'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'SLA_BREACHED',
        'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING', 'MIS_HELD', 'PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING', 'MIS_BOOKING_FAILED',
        'CANCELLATION_REQUESTED', 'RESCHEDULE_REQUESTED', 'COMPLETED'
      ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.booking_holds
      DROP CONSTRAINT IF EXISTS booking_holds_state_check;
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_state_check
      CHECK (state IN (
        'MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'SLA_BREACHED',
        'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING', 'MIS_HELD', 'PAYMENT_PENDING',
        'PAYMENT_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING', 'MIS_BOOKING_FAILED'
      ));
    ALTER TABLE booking_schema.booking_holds
      DROP COLUMN IF EXISTS clinical_summary;

    DROP INDEX IF EXISTS pet_schema.pet_documents_pet_idx;
    DROP INDEX IF EXISTS pet_schema.pet_documents_processing_idx;
    DROP TABLE IF EXISTS pet_schema.pet_documents;

    ALTER TABLE pet_schema.pets
      DROP CONSTRAINT IF EXISTS pets_gender_check,
      DROP CONSTRAINT IF EXISTS pets_age_months_check,
      DROP COLUMN IF EXISTS medical_history_ocr,
      DROP COLUMN IF EXISTS chip_number,
      DROP COLUMN IF EXISTS is_sterilized,
      DROP COLUMN IF EXISTS gender,
      DROP COLUMN IF EXISTS age_months;

    DROP INDEX IF EXISTS clinic_schema.appointment_slots_doctor_search_idx;
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_specialty_search_idx;
    ALTER TABLE clinic_schema.appointment_slots
      DROP COLUMN IF EXISTS specialty_id,
      DROP COLUMN IF EXISTS doctor_id;

    DROP INDEX IF EXISTS catalog_schema.doctors_location_specialty_idx;
    DROP TABLE IF EXISTS catalog_schema.doctors;
    DROP TABLE IF EXISTS catalog_schema.specialties;
  `);
};
