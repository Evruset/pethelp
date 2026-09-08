/* eslint-disable camelcase */

exports.shorthands = undefined;

const functionSql = ({allowTerminal}) => `
  CREATE OR REPLACE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence()
  RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE
    target_case_id uuid;
    accepted_count integer;
    linked record;
  BEGIN
    IF TG_TABLE_NAME = 'reallocation_cases' THEN
      target_case_id := NEW.id;
      ${allowTerminal ? `IF TG_OP = 'UPDATE' AND OLD.accepted_offer_id IS NOT NULL AND
        ROW(OLD.accepted_offer_id,OLD.replacement_booking_hold_id,OLD.acceptance_idempotency_key,OLD.accepted_at)
          IS DISTINCT FROM
        ROW(NEW.accepted_offer_id,NEW.replacement_booking_hold_id,NEW.acceptance_idempotency_key,NEW.accepted_at)
      THEN RAISE EXCEPTION 'REALLOCATION_ACCEPTANCE_LINEAGE_IMMUTABLE' USING ERRCODE = '23514'; END IF;` : ''}
    ELSE
      target_case_id := NEW.reallocation_case_id;
      ${allowTerminal ? `IF TG_OP = 'UPDATE' AND OLD.status = 'ACCEPTED' AND
        ROW(OLD.id,OLD.reallocation_case_id,OLD.clinic_id,OLD.location_id,OLD.doctor_id,OLD.service_id,
          OLD.doctor_service_id,OLD.slot_id,OLD.slot_version,OLD.rank,OLD.starts_at,OLD.ends_at,
          OLD.distance_meters,OLD.price_amount,OLD.price_currency,OLD.status,OLD.version,OLD.created_at,OLD.expires_at)
          IS DISTINCT FROM
        ROW(NEW.id,NEW.reallocation_case_id,NEW.clinic_id,NEW.location_id,NEW.doctor_id,NEW.service_id,
          NEW.doctor_service_id,NEW.slot_id,NEW.slot_version,NEW.rank,NEW.starts_at,NEW.ends_at,
          NEW.distance_meters,NEW.price_amount,NEW.price_currency,NEW.status,NEW.version,NEW.created_at,NEW.expires_at)
      THEN RAISE EXCEPTION 'REALLOCATION_ACCEPTED_OFFER_IMMUTABLE' USING ERRCODE = '23514'; END IF;` : ''}
    END IF;

    SELECT c.id, c.status, c.accepted_offer_id, c.replacement_booking_hold_id,
           c.acceptance_idempotency_key, c.accepted_at, c.owner_id,
           o.id offer_id, o.status offer_status, o.slot_id, o.slot_version,
           h.id hold_id, h.owner_id hold_owner_id, h.slot_id hold_slot_id,
           slot.version current_slot_version
    INTO linked
    FROM booking_schema.reallocation_cases c
    LEFT JOIN booking_schema.reallocation_offers o
      ON o.id = c.accepted_offer_id AND o.reallocation_case_id = c.id
    LEFT JOIN booking_schema.booking_holds h ON h.id = c.replacement_booking_hold_id
    LEFT JOIN clinic_schema.appointment_slots slot ON slot.id = o.slot_id
    WHERE c.id = target_case_id;

    IF linked.id IS NULL THEN RETURN NEW; END IF;
    SELECT count(*)::integer INTO accepted_count
    FROM booking_schema.reallocation_offers
    WHERE reallocation_case_id = target_case_id AND status = 'ACCEPTED';

    IF linked.status = 'REPLACEMENT_PENDING_CONFIRMATION' THEN
      IF linked.offer_id IS NULL OR linked.offer_status <> 'ACCEPTED' OR accepted_count <> 1
        OR linked.hold_id IS NULL OR linked.hold_owner_id <> linked.owner_id
        OR linked.hold_slot_id <> linked.slot_id
        OR linked.current_slot_version <> linked.slot_version + 1
        OR EXISTS (SELECT 1 FROM booking_schema.reallocation_offers WHERE reallocation_case_id=target_case_id AND id<>linked.offer_id AND status='OFFERED')
      THEN RAISE EXCEPTION 'REALLOCATION_ACCEPTANCE_LINEAGE_INVALID' USING ERRCODE = '23514'; END IF;
    ${allowTerminal ? `ELSIF linked.status = 'CLOSED' AND linked.accepted_offer_id IS NOT NULL THEN
      IF linked.offer_id IS NULL OR linked.offer_status <> 'ACCEPTED' OR accepted_count <> 1
        OR linked.hold_id IS NULL OR linked.hold_owner_id <> linked.owner_id
        OR linked.hold_slot_id <> linked.slot_id
        OR EXISTS (SELECT 1 FROM booking_schema.reallocation_offers WHERE reallocation_case_id=target_case_id AND id<>linked.offer_id AND status='OFFERED')
      THEN RAISE EXCEPTION 'REALLOCATION_TERMINAL_ACCEPTANCE_LINEAGE_INVALID' USING ERRCODE = '23514'; END IF;` : ''}
    ELSIF accepted_count <> 0 THEN
      RAISE EXCEPTION 'REALLOCATION_ACCEPTED_OFFER_WITHOUT_PENDING_CASE' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END $$;
`;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_acceptance_set_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_acceptance_set_check CHECK (
      (status = 'REPLACEMENT_PENDING_CONFIRMATION' AND accepted_offer_id IS NOT NULL
        AND replacement_booking_hold_id IS NOT NULL AND acceptance_idempotency_key IS NOT NULL AND accepted_at IS NOT NULL)
      OR (status = 'CLOSED' AND (
        (accepted_offer_id IS NULL AND replacement_booking_hold_id IS NULL AND acceptance_idempotency_key IS NULL AND accepted_at IS NULL)
        OR (accepted_offer_id IS NOT NULL AND replacement_booking_hold_id IS NOT NULL AND acceptance_idempotency_key IS NOT NULL AND accepted_at IS NOT NULL)
      ))
      OR (status NOT IN ('REPLACEMENT_PENDING_CONFIRMATION','CLOSED') AND accepted_offer_id IS NULL
        AND replacement_booking_hold_id IS NULL AND acceptance_idempotency_key IS NULL AND accepted_at IS NULL)
    );
    ${functionSql({allowTerminal:true})}
    DROP TRIGGER reallocation_offers_acceptance_coherence_trigger ON booking_schema.reallocation_offers;
    CREATE CONSTRAINT TRIGGER reallocation_offers_acceptance_coherence_trigger
      AFTER INSERT OR UPDATE ON booking_schema.reallocation_offers DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM booking_schema.reallocation_cases WHERE status='CLOSED' AND accepted_offer_id IS NOT NULL) THEN
        RAISE EXCEPTION 'W6C2_TERMINAL_ACCEPTANCE_DOWN_REMEDIATION_APPROVAL_REQUIRED';
      END IF;
    END $$;
    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_acceptance_set_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_acceptance_set_check CHECK (
      (status = 'REPLACEMENT_PENDING_CONFIRMATION' AND accepted_offer_id IS NOT NULL
        AND replacement_booking_hold_id IS NOT NULL AND acceptance_idempotency_key IS NOT NULL AND accepted_at IS NOT NULL)
      OR (status <> 'REPLACEMENT_PENDING_CONFIRMATION' AND accepted_offer_id IS NULL
        AND replacement_booking_hold_id IS NULL AND acceptance_idempotency_key IS NULL AND accepted_at IS NULL)
    );
    ${functionSql({allowTerminal:false})}
    DROP TRIGGER reallocation_offers_acceptance_coherence_trigger ON booking_schema.reallocation_offers;
    CREATE CONSTRAINT TRIGGER reallocation_offers_acceptance_coherence_trigger
      AFTER INSERT OR UPDATE OF status, reallocation_case_id
      ON booking_schema.reallocation_offers DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence();
  `);
};
