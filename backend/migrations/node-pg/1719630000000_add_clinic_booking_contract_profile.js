exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinics
      ADD COLUMN IF NOT EXISTS booking_contract_profile text NOT NULL DEFAULT 'MVP_V1_MANUAL',
      ADD COLUMN IF NOT EXISTS booking_contract_profile_version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS booking_contract_profile_updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
    ALTER TABLE clinic_schema.clinics
      ADD CONSTRAINT clinics_booking_contract_profile_check CHECK (booking_contract_profile IN ('MVP_V1_MANUAL', 'V15_AUTO_CONFIRM')),
      ADD CONSTRAINT clinics_booking_contract_profile_version_check CHECK (booking_contract_profile_version > 0);

    CREATE TABLE clinic_schema.booking_contract_profile_history (
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE CASCADE,
      version integer NOT NULL CHECK (version > 0),
      contract_profile text NOT NULL CHECK (contract_profile IN ('MVP_V1_MANUAL', 'V15_AUTO_CONFIRM')),
      changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      changed_by text NOT NULL DEFAULT session_user,
      PRIMARY KEY (clinic_id, version)
    );

    CREATE FUNCTION clinic_schema.prepare_booking_contract_profile_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.booking_contract_profile_version := OLD.booking_contract_profile_version + 1;
      NEW.booking_contract_profile_updated_at := clock_timestamp();
      RETURN NEW;
    END;
    $$;
    CREATE FUNCTION clinic_schema.record_booking_contract_profile_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO clinic_schema.booking_contract_profile_history (
        clinic_id, version, contract_profile, changed_at, changed_by
      ) VALUES (
        NEW.id, NEW.booking_contract_profile_version, NEW.booking_contract_profile,
        NEW.booking_contract_profile_updated_at, session_user
      );
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER clinics_prepare_booking_contract_profile_change
      BEFORE UPDATE OF booking_contract_profile ON clinic_schema.clinics
      FOR EACH ROW WHEN (OLD.booking_contract_profile IS DISTINCT FROM NEW.booking_contract_profile)
      EXECUTE FUNCTION clinic_schema.prepare_booking_contract_profile_change();
    CREATE TRIGGER clinics_record_booking_contract_profile_insert
      AFTER INSERT ON clinic_schema.clinics
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.record_booking_contract_profile_change();
    CREATE TRIGGER clinics_record_booking_contract_profile_update
      AFTER UPDATE OF booking_contract_profile ON clinic_schema.clinics
      FOR EACH ROW WHEN (OLD.booking_contract_profile IS DISTINCT FROM NEW.booking_contract_profile)
      EXECUTE FUNCTION clinic_schema.record_booking_contract_profile_change();

    INSERT INTO clinic_schema.booking_contract_profile_history (
      clinic_id, version, contract_profile, changed_at, changed_by
    )
    SELECT id, booking_contract_profile_version, booking_contract_profile,
           booking_contract_profile_updated_at, session_user
    FROM clinic_schema.clinics;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER clinics_record_booking_contract_profile_update ON clinic_schema.clinics;
    DROP TRIGGER clinics_record_booking_contract_profile_insert ON clinic_schema.clinics;
    DROP TRIGGER clinics_prepare_booking_contract_profile_change ON clinic_schema.clinics;
    DROP FUNCTION clinic_schema.record_booking_contract_profile_change();
    DROP FUNCTION clinic_schema.prepare_booking_contract_profile_change();
    DROP TABLE clinic_schema.booking_contract_profile_history;
    ALTER TABLE clinic_schema.clinics
      DROP CONSTRAINT clinics_booking_contract_profile_version_check,
      DROP CONSTRAINT clinics_booking_contract_profile_check,
      DROP COLUMN booking_contract_profile_updated_at,
      DROP COLUMN booking_contract_profile_version,
      DROP COLUMN booking_contract_profile;
  `);
};
