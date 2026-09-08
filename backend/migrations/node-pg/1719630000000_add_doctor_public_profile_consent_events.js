/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE catalog_schema.doctor_public_profile_consent_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id uuid NOT NULL,
      clinic_location_id uuid NOT NULL,
      event_type text NOT NULL,
      actor_id uuid NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT doctor_public_profile_consent_events_doctor_location_fkey
        FOREIGN KEY (doctor_id, clinic_location_id)
        REFERENCES catalog_schema.doctors (id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_public_profile_consent_events_actor_location_fkey
        FOREIGN KEY (actor_id, clinic_location_id)
        REFERENCES clinic_schema.employee_location_memberships (employee_id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_public_profile_consent_events_type_check
        CHECK (event_type IN ('CONSENT_GRANTED', 'CONSENT_REVOKED')),
      CONSTRAINT doctor_public_profile_consent_events_time_check
        CHECK (created_at >= occurred_at)
    );

    CREATE INDEX doctor_public_profile_consent_events_latest_idx
      ON catalog_schema.doctor_public_profile_consent_events
        (doctor_id, clinic_location_id, occurred_at DESC, id DESC);

    CREATE FUNCTION catalog_schema.validate_doctor_public_profile_consent_event()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      previous_event text;
      previous_occurred_at timestamptz;
      actor_authorized boolean;
    BEGIN
      PERFORM 1 FROM catalog_schema.doctors doctor
      WHERE doctor.id = NEW.doctor_id AND doctor.clinic_location_id = NEW.clinic_location_id
      FOR UPDATE;

      SELECT membership.active = true
             AND membership.revoked_at IS NULL
             AND membership.role = 'CLINIC_ADMIN'
        INTO actor_authorized
      FROM clinic_schema.employee_location_memberships membership
      WHERE membership.employee_id = NEW.actor_id
        AND membership.clinic_location_id = NEW.clinic_location_id
      FOR UPDATE;

      IF actor_authorized IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_ACTOR_NOT_AUTHORIZED' USING ERRCODE = '23514';
      END IF;
      IF NEW.occurred_at > clock_timestamp() OR NEW.created_at < NEW.occurred_at THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_TIME_INVALID' USING ERRCODE = '23514';
      END IF;

      SELECT event.event_type, event.occurred_at
        INTO previous_event, previous_occurred_at
      FROM catalog_schema.doctor_public_profile_consent_events event
      WHERE event.doctor_id = NEW.doctor_id AND event.clinic_location_id = NEW.clinic_location_id
      ORDER BY event.occurred_at DESC, event.id DESC LIMIT 1;

      IF previous_occurred_at IS NOT NULL AND NEW.occurred_at <= previous_occurred_at THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_TIME_NOT_MONOTONIC' USING ERRCODE = '23514';
      END IF;
      IF NEW.event_type = 'CONSENT_GRANTED' AND previous_event = 'CONSENT_GRANTED' THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_ALREADY_GRANTED' USING ERRCODE = '23514';
      END IF;
      IF NEW.event_type = 'CONSENT_REVOKED' AND previous_event IS DISTINCT FROM 'CONSENT_GRANTED' THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_NOT_GRANTED' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;

    CREATE TRIGGER doctor_public_profile_consent_event_validation_trigger
      BEFORE INSERT ON catalog_schema.doctor_public_profile_consent_events
      FOR EACH ROW EXECUTE FUNCTION catalog_schema.validate_doctor_public_profile_consent_event();

    CREATE FUNCTION catalog_schema.protect_doctor_public_profile_consent_audit()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_AUDIT_IMMUTABLE' USING ERRCODE = '23514';
    END $$;

    CREATE TRIGGER doctor_public_profile_consent_audit_immutability_trigger
      BEFORE UPDATE OR DELETE ON catalog_schema.doctor_public_profile_consent_events
      FOR EACH ROW EXECUTE FUNCTION catalog_schema.protect_doctor_public_profile_consent_audit();

    CREATE TRIGGER doctor_public_profile_consent_audit_truncate_guard
      BEFORE TRUNCATE ON catalog_schema.doctor_public_profile_consent_events
      FOR EACH STATEMENT EXECUTE FUNCTION catalog_schema.protect_doctor_public_profile_consent_audit();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    LOCK TABLE catalog_schema.doctor_public_profile_consent_events IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM catalog_schema.doctor_public_profile_consent_events) THEN
        RAISE EXCEPTION 'PUBLIC_DOCTOR_PROFILE_CONSENT_DOWN_REQUIRES_DATA_GOVERNANCE_APPROVAL';
      END IF;
    END $$;
    DROP TABLE catalog_schema.doctor_public_profile_consent_events;
    DROP FUNCTION catalog_schema.protect_doctor_public_profile_consent_audit();
    DROP FUNCTION catalog_schema.validate_doctor_public_profile_consent_event();
  `);
};
