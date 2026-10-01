exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION audit_schema.reject_clinic_booking_contract_profile_audit_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'clinic booking contract profile audit is append-only';
    END;
    $$;

    CREATE TRIGGER clinic_booking_contract_profile_audit_reject_row_mutation
    BEFORE UPDATE OR DELETE ON audit_schema.clinic_booking_contract_profile_audit
    FOR EACH ROW EXECUTE FUNCTION audit_schema.reject_clinic_booking_contract_profile_audit_mutation();

    CREATE TRIGGER clinic_booking_contract_profile_audit_reject_truncate
    BEFORE TRUNCATE ON audit_schema.clinic_booking_contract_profile_audit
    FOR EACH STATEMENT EXECUTE FUNCTION audit_schema.reject_clinic_booking_contract_profile_audit_mutation();

    REVOKE UPDATE, DELETE, TRUNCATE
      ON audit_schema.clinic_booking_contract_profile_audit FROM PUBLIC;

    CREATE OR REPLACE FUNCTION clinic_schema.record_booking_contract_profile_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      reference text := NULLIF(current_setting('app.change_reference', true), '');
    BEGIN
      INSERT INTO clinic_schema.booking_contract_profile_history (
        clinic_id, version, contract_profile, changed_at, changed_by
      ) VALUES (
        NEW.id, NEW.booking_contract_profile_version, NEW.booking_contract_profile,
        NEW.booking_contract_profile_updated_at, session_user
      );
      INSERT INTO audit_schema.clinic_booking_contract_profile_audit (
        clinic_id, version, contract_profile, changed_at, changed_by, change_reference
      ) VALUES (
        NEW.id, NEW.booking_contract_profile_version, NEW.booking_contract_profile,
        NEW.booking_contract_profile_updated_at, session_user, reference
      );
      RETURN NEW;
    END;
    $$;

    COMMENT ON COLUMN audit_schema.clinic_booking_contract_profile_audit.changed_by IS
      'Database session role; not evidence of a human approver identity.';
    COMMENT ON COLUMN audit_schema.clinic_booking_contract_profile_audit.change_reference IS
      'Caller-supplied diagnostic reference; not authorization or approval evidence.';
  `);
};

// Safety barrier: application policy rollback is AUTO -> MANUAL. Schema rollback
// would remove the version source while its append-only audit keys must survive.
exports.down = () => {
  throw new Error('IRREVERSIBLE_AUDIT_SAFETY_BARRIER');
};
