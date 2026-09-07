/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE booking_schema.booking_holds
      ADD CONSTRAINT booking_holds_id_owner_key UNIQUE (id, owner_id);

    ALTER TABLE booking_schema.reallocation_offers
      ADD CONSTRAINT reallocation_offers_id_case_key UNIQUE (id, reallocation_case_id);

    ALTER TABLE booking_schema.reallocation_cases
      ADD COLUMN accepted_offer_id uuid,
      ADD COLUMN replacement_booking_hold_id uuid,
      ADD COLUMN acceptance_idempotency_key uuid,
      ADD COLUMN accepted_at timestamptz,
      ADD CONSTRAINT reallocation_cases_accepted_offer_fkey
        FOREIGN KEY (accepted_offer_id, id)
        REFERENCES booking_schema.reallocation_offers(id, reallocation_case_id) ON DELETE RESTRICT,
      ADD CONSTRAINT reallocation_cases_replacement_hold_owner_fkey
        FOREIGN KEY (replacement_booking_hold_id, owner_id)
        REFERENCES booking_schema.booking_holds(id, owner_id) ON DELETE RESTRICT,
      ADD CONSTRAINT reallocation_cases_replacement_hold_key UNIQUE (replacement_booking_hold_id),
      ADD CONSTRAINT reallocation_cases_acceptance_identity_key UNIQUE (acceptance_idempotency_key);

    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_status_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_status_check
      CHECK (status IN ('OPEN','REPLACEMENT_PENDING_CONFIRMATION','CLOSED','CANCELLED'));
    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_time_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_time_check CHECK (
      updated_at >= created_at AND state_changed_at >= created_at AND
      ((status IN ('OPEN','REPLACEMENT_PENDING_CONFIRMATION') AND terminal_at IS NULL) OR
       (status IN ('CLOSED','CANCELLED') AND terminal_at IS NOT NULL AND terminal_at >= created_at))
    );
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_acceptance_set_check CHECK (
      (status = 'REPLACEMENT_PENDING_CONFIRMATION' AND accepted_offer_id IS NOT NULL
        AND replacement_booking_hold_id IS NOT NULL AND acceptance_idempotency_key IS NOT NULL AND accepted_at IS NOT NULL)
      OR
      (status <> 'REPLACEMENT_PENDING_CONFIRMATION' AND accepted_offer_id IS NULL
        AND replacement_booking_hold_id IS NULL AND acceptance_idempotency_key IS NULL AND accepted_at IS NULL)
    );

    ALTER TABLE booking_schema.reallocation_offers DROP CONSTRAINT reallocation_offers_status_check;
    ALTER TABLE booking_schema.reallocation_offers ADD CONSTRAINT reallocation_offers_status_check
      CHECK (status IN ('OFFERED','INVALIDATED','ACCEPTED'));

    CREATE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      target_case_id uuid;
      accepted_count integer;
      linked record;
    BEGIN
      IF TG_TABLE_NAME = 'reallocation_cases' THEN
        target_case_id := NEW.id;
      ELSE
        target_case_id := NEW.reallocation_case_id;
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
          OR EXISTS (
            SELECT 1 FROM booking_schema.reallocation_offers
            WHERE reallocation_case_id = target_case_id AND id <> linked.offer_id AND status = 'OFFERED'
          )
        THEN
          RAISE EXCEPTION 'REALLOCATION_ACCEPTANCE_LINEAGE_INVALID' USING ERRCODE = '23514';
        END IF;
      ELSIF accepted_count <> 0 THEN
        RAISE EXCEPTION 'REALLOCATION_ACCEPTED_OFFER_WITHOUT_PENDING_CASE' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;

    CREATE CONSTRAINT TRIGGER reallocation_cases_acceptance_coherence_trigger
      AFTER INSERT OR UPDATE OF status, accepted_offer_id, replacement_booking_hold_id,
        acceptance_idempotency_key, accepted_at
      ON booking_schema.reallocation_cases DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence();
    CREATE CONSTRAINT TRIGGER reallocation_offers_acceptance_coherence_trigger
      AFTER INSERT OR UPDATE OF status, reallocation_case_id
      ON booking_schema.reallocation_offers DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_acceptance_coherence();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM booking_schema.reallocation_cases
        WHERE status = 'REPLACEMENT_PENDING_CONFIRMATION' OR accepted_offer_id IS NOT NULL
          OR replacement_booking_hold_id IS NOT NULL OR acceptance_idempotency_key IS NOT NULL OR accepted_at IS NOT NULL
      ) OR EXISTS (SELECT 1 FROM booking_schema.reallocation_offers WHERE status = 'ACCEPTED') THEN
        RAISE EXCEPTION 'W6C1_ACCEPTANCE_LINEAGE_DOWN_DATA_REMEDIATION_APPROVAL_REQUIRED';
      END IF;
    END $$;

    DROP TRIGGER IF EXISTS reallocation_offers_acceptance_coherence_trigger ON booking_schema.reallocation_offers;
    DROP TRIGGER IF EXISTS reallocation_cases_acceptance_coherence_trigger ON booking_schema.reallocation_cases;
    DROP FUNCTION IF EXISTS booking_schema.enforce_reallocation_acceptance_coherence();

    ALTER TABLE booking_schema.reallocation_offers DROP CONSTRAINT reallocation_offers_status_check;
    ALTER TABLE booking_schema.reallocation_offers ADD CONSTRAINT reallocation_offers_status_check
      CHECK (status IN ('OFFERED','INVALIDATED'));

    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_acceptance_set_check;
    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_time_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_time_check CHECK (
      updated_at >= created_at AND state_changed_at >= created_at AND
      ((status = 'OPEN' AND terminal_at IS NULL) OR
       (status IN ('CLOSED','CANCELLED') AND terminal_at IS NOT NULL AND terminal_at >= created_at))
    );
    ALTER TABLE booking_schema.reallocation_cases DROP CONSTRAINT reallocation_cases_status_check;
    ALTER TABLE booking_schema.reallocation_cases ADD CONSTRAINT reallocation_cases_status_check
      CHECK (status IN ('OPEN','CLOSED','CANCELLED'));
    ALTER TABLE booking_schema.reallocation_cases
      DROP CONSTRAINT reallocation_cases_acceptance_identity_key,
      DROP CONSTRAINT reallocation_cases_replacement_hold_key,
      DROP CONSTRAINT reallocation_cases_replacement_hold_owner_fkey,
      DROP CONSTRAINT reallocation_cases_accepted_offer_fkey,
      DROP COLUMN accepted_at,
      DROP COLUMN acceptance_idempotency_key,
      DROP COLUMN replacement_booking_hold_id,
      DROP COLUMN accepted_offer_id;
    ALTER TABLE booking_schema.reallocation_offers DROP CONSTRAINT reallocation_offers_id_case_key;
    ALTER TABLE booking_schema.booking_holds DROP CONSTRAINT booking_holds_id_owner_key;
  `);
};
