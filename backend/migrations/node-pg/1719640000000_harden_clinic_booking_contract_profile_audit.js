exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_schema.clinic_booking_contract_profile_audit (
      clinic_id uuid NOT NULL,
      version integer NOT NULL CHECK (version > 0),
      contract_profile text NOT NULL CHECK (contract_profile IN ('MVP_V1_MANUAL', 'V15_AUTO_CONFIRM')),
      changed_at timestamptz NOT NULL,
      changed_by text NOT NULL,
      change_reference text,
      PRIMARY KEY (clinic_id, version)
    );

    INSERT INTO audit_schema.clinic_booking_contract_profile_audit (
      clinic_id, version, contract_profile, changed_at, changed_by, change_reference
    )
    SELECT clinic_id, version, contract_profile, changed_at, changed_by, 'wave1-initial-backfill'
    FROM clinic_schema.booking_contract_profile_history;

    CREATE OR REPLACE FUNCTION clinic_schema.record_booking_contract_profile_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      actor text := COALESCE(NULLIF(current_setting('app.actor_id', true), ''), session_user);
      reference text := NULLIF(current_setting('app.change_reference', true), '');
    BEGIN
      INSERT INTO clinic_schema.booking_contract_profile_history (
        clinic_id, version, contract_profile, changed_at, changed_by
      ) VALUES (
        NEW.id, NEW.booking_contract_profile_version, NEW.booking_contract_profile,
        NEW.booking_contract_profile_updated_at, actor
      );
      INSERT INTO audit_schema.clinic_booking_contract_profile_audit (
        clinic_id, version, contract_profile, changed_at, changed_by, change_reference
      ) VALUES (
        NEW.id, NEW.booking_contract_profile_version, NEW.booking_contract_profile,
        NEW.booking_contract_profile_updated_at, actor, reference
      );
      RETURN NEW;
    END;
    $$;

    COMMENT ON TABLE audit_schema.clinic_booking_contract_profile_audit IS
      'Forward-only audit evidence. Do not drop during booking policy rollback.';
  `);
};

// Forward-only: removing this table would destroy booking-policy approval history.
exports.down = () => undefined;
