/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.clinics
      ADD COLUMN IF NOT EXISTS is_emergency_public boolean NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_capabilities_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (status IN ('PENDING_REVIEW', 'VERIFIED', 'REVOKED', 'EXPIRED')),
      evidence_url text NOT NULL CHECK (evidence_url ~ '^https?://'),
      verified_by uuid REFERENCES identity_schema.users(id),
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT emergency_capabilities_reviews_verified_fields_check CHECK (
        (status = 'VERIFIED' AND verified_by IS NOT NULL AND expires_at IS NOT NULL)
        OR status <> 'VERIFIED'
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS emergency_capabilities_reviews_one_active_idx
      ON clinic_schema.emergency_capabilities_reviews (clinic_id)
      WHERE status IN ('PENDING_REVIEW', 'VERIFIED');

    CREATE INDEX IF NOT EXISTS emergency_capabilities_reviews_freshness_idx
      ON clinic_schema.emergency_capabilities_reviews (expires_at)
      WHERE status = 'VERIFIED';

    CREATE OR REPLACE FUNCTION clinic_schema.enforce_emergency_public_guard()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'UPDATE' AND NEW.is_emergency_public IS DISTINCT FROM OLD.is_emergency_public THEN
        IF current_setting('vethelp.emergency_ops_actor', true) NOT IN ('PLATFORM_ADMIN', 'SYSTEM_WORKER') THEN
          RAISE EXCEPTION 'Emergency public flag can only be changed by platform operations' USING ERRCODE = '42501';
        END IF;
        IF NEW.is_emergency_public AND NOT EXISTS (
          SELECT 1 FROM clinic_schema.emergency_capabilities_reviews r
          WHERE r.clinic_id = NEW.id AND r.status = 'VERIFIED' AND r.expires_at > clock_timestamp()
        ) THEN
          RAISE EXCEPTION 'Emergency public flag requires an unexpired VERIFIED review' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS clinics_enforce_emergency_public_guard ON clinic_schema.clinics;
    CREATE TRIGGER clinics_enforce_emergency_public_guard
      BEFORE UPDATE OF is_emergency_public ON clinic_schema.clinics
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.enforce_emergency_public_guard();

    CREATE OR REPLACE FUNCTION clinic_schema.sync_emergency_profile_review()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM set_config('vethelp.emergency_review_actor', 'PLATFORM_ADMIN', true);
      IF NEW.status = 'VERIFIED' THEN
        UPDATE clinic_schema.emergency_capability_profiles p
        SET verification_status = 'VERIFIED', verified_at = clock_timestamp(),
            valid_until = LEAST(p.valid_until, NEW.expires_at), updated_at = clock_timestamp()
        FROM clinic_schema.clinic_locations l
        WHERE p.clinic_location_id = l.id AND l.clinic_id = NEW.clinic_id;
      ELSIF NEW.status IN ('REVOKED', 'EXPIRED') THEN
        UPDATE clinic_schema.emergency_capability_profiles p
        SET verification_status = 'EXPIRED', verified_at = NULL, updated_at = clock_timestamp()
        FROM clinic_schema.clinic_locations l
        WHERE p.clinic_location_id = l.id AND l.clinic_id = NEW.clinic_id;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS emergency_capabilities_reviews_sync_profile ON clinic_schema.emergency_capabilities_reviews;
    CREATE TRIGGER emergency_capabilities_reviews_sync_profile
      AFTER INSERT OR UPDATE OF status, expires_at ON clinic_schema.emergency_capabilities_reviews
      FOR EACH ROW EXECUTE FUNCTION clinic_schema.sync_emergency_profile_review();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS emergency_capabilities_reviews_sync_profile ON clinic_schema.emergency_capabilities_reviews;
    DROP FUNCTION IF EXISTS clinic_schema.sync_emergency_profile_review();
    DROP TRIGGER IF EXISTS clinics_enforce_emergency_public_guard ON clinic_schema.clinics;
    DROP FUNCTION IF EXISTS clinic_schema.enforce_emergency_public_guard();
    DROP INDEX IF EXISTS clinic_schema.emergency_capabilities_reviews_freshness_idx;
    DROP INDEX IF EXISTS clinic_schema.emergency_capabilities_reviews_one_active_idx;
    DROP TABLE IF EXISTS clinic_schema.emergency_capabilities_reviews;
    ALTER TABLE clinic_schema.clinics DROP COLUMN IF EXISTS is_emergency_public;
  `);
};
