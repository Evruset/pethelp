/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION clinic_schema.enforce_emergency_review_boundary()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF current_setting('vethelp.emergency_review_actor', true) IS DISTINCT FROM 'PLATFORM_ADMIN' THEN
        NEW.verification_status := 'PENDING';
        NEW.verified_at := NULL;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS emergency_profile_review_boundary ON clinic_schema.emergency_capability_profiles;
    CREATE TRIGGER emergency_profile_review_boundary
      BEFORE INSERT OR UPDATE OF verification_status, verified_at, emergency_status, capability_version, valid_until
      ON clinic_schema.emergency_capability_profiles
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.enforce_emergency_review_boundary();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS emergency_profile_review_boundary ON clinic_schema.emergency_capability_profiles;
    DROP FUNCTION IF EXISTS clinic_schema.enforce_emergency_review_boundary();
  `);
};
