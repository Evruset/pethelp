/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE booking_schema.reallocation_cases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_change_request_id uuid NOT NULL REFERENCES booking_schema.booking_change_requests(id) ON DELETE RESTRICT,
      booking_hold_id uuid NOT NULL,
      appointment_id uuid NOT NULL,
      owner_id uuid NOT NULL,
      source_clinic_id uuid NOT NULL,
      source_location_id uuid NOT NULL,
      source_slot_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'OPEN',
      idempotency_key uuid NOT NULL,
      correlation_id uuid NOT NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      state_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      terminal_at timestamptz,
      CONSTRAINT reallocation_cases_status_check CHECK (status IN ('OPEN','CLOSED','CANCELLED')),
      CONSTRAINT reallocation_cases_version_check CHECK (version > 0),
      CONSTRAINT reallocation_cases_time_check CHECK (
        updated_at >= created_at AND state_changed_at >= created_at AND
        ((status = 'OPEN' AND terminal_at IS NULL) OR
         (status IN ('CLOSED','CANCELLED') AND terminal_at IS NOT NULL AND terminal_at >= created_at))
      ),
      CONSTRAINT reallocation_cases_hold_context_fkey
        FOREIGN KEY (booking_hold_id, owner_id, source_slot_id)
        REFERENCES booking_schema.booking_holds(id, owner_id, slot_id) ON DELETE RESTRICT,
      CONSTRAINT reallocation_cases_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, source_location_id, source_slot_id)
        REFERENCES booking_schema.appointments(id, hold_id, owner_id, clinic_location_id, slot_id) ON DELETE RESTRICT,
      CONSTRAINT reallocation_cases_source_location_fkey
        FOREIGN KEY (source_location_id, source_clinic_id)
        REFERENCES clinic_schema.clinic_locations(id, clinic_id) ON DELETE RESTRICT,
      CONSTRAINT reallocation_cases_request_key UNIQUE (booking_change_request_id),
      CONSTRAINT reallocation_cases_owner_idempotency_key UNIQUE (owner_id, idempotency_key)
    );

    CREATE UNIQUE INDEX reallocation_cases_one_active_booking_idx
      ON booking_schema.reallocation_cases(booking_hold_id) WHERE status = 'OPEN';
    CREATE INDEX reallocation_cases_owner_read_idx
      ON booking_schema.reallocation_cases(owner_id, created_at DESC, id DESC);
    CREATE INDEX reallocation_cases_operations_idx
      ON booking_schema.reallocation_cases(status, created_at, id) WHERE status = 'OPEN';

    CREATE FUNCTION booking_schema.enforce_reallocation_case_booking_identity()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM booking_schema.booking_change_requests request
        WHERE request.id = NEW.booking_change_request_id
          AND request.request_type = 'RESCHEDULE'
          AND request.booking_hold_id = NEW.booking_hold_id
          AND request.appointment_id = NEW.appointment_id
          AND request.owner_id = NEW.owner_id
          AND request.clinic_id = NEW.source_clinic_id
          AND request.location_id = NEW.source_location_id
          AND request.slot_id = NEW.source_slot_id
      ) THEN
        RAISE EXCEPTION 'REALLOCATION_CASE_BOOKING_IDENTITY_INVALID' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER reallocation_cases_booking_identity_trigger
      BEFORE INSERT OR UPDATE OF booking_change_request_id, booking_hold_id,
        appointment_id, owner_id, source_clinic_id, source_location_id, source_slot_id
      ON booking_schema.reallocation_cases
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_case_booking_identity();

    CREATE TABLE booking_schema.reallocation_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reallocation_case_id uuid NOT NULL REFERENCES booking_schema.reallocation_cases(id) ON DELETE RESTRICT,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      doctor_id uuid NOT NULL,
      service_id uuid NOT NULL,
      doctor_service_id uuid NOT NULL REFERENCES clinic_schema.doctor_services(id) ON DELETE RESTRICT,
      slot_id uuid NOT NULL,
      slot_version integer NOT NULL,
      rank smallint NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      distance_meters numeric(12,2),
      price_amount numeric(12,2),
      price_currency char(3),
      status text NOT NULL DEFAULT 'OFFERED',
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '15 minutes'),
      CONSTRAINT reallocation_offers_status_check CHECK (status IN ('OFFERED','INVALIDATED')),
      CONSTRAINT reallocation_offers_versions_check CHECK (slot_version > 0 AND version > 0),
      CONSTRAINT reallocation_offers_rank_check CHECK (rank BETWEEN 1 AND 5),
      CONSTRAINT reallocation_offers_bounds_check CHECK (ends_at > starts_at),
      CONSTRAINT reallocation_offers_expiry_check CHECK (expires_at = created_at + interval '15 minutes'),
      CONSTRAINT reallocation_offers_distance_check CHECK (distance_meters IS NULL OR distance_meters >= 0),
      CONSTRAINT reallocation_offers_price_check CHECK (
        (price_amount IS NULL AND price_currency IS NULL) OR
        (price_amount > 0 AND price_currency ~ '^[A-Z]{3}$')
      ),
      CONSTRAINT reallocation_offers_location_fkey
        FOREIGN KEY (location_id, clinic_id) REFERENCES clinic_schema.clinic_locations(id, clinic_id) ON DELETE RESTRICT,
      CONSTRAINT reallocation_offers_slot_fkey
        FOREIGN KEY (slot_id, location_id) REFERENCES clinic_schema.appointment_slots(id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT reallocation_offers_candidate_key UNIQUE (reallocation_case_id, slot_id, slot_version),
      CONSTRAINT reallocation_offers_rank_key UNIQUE (reallocation_case_id, rank)
    );

    CREATE INDEX reallocation_offers_case_rank_idx
      ON booking_schema.reallocation_offers(reallocation_case_id, rank, id);

    CREATE FUNCTION booking_schema.enforce_reallocation_offer_candidate_identity()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM clinic_schema.appointment_slots slot
        JOIN clinic_schema.doctor_services ds ON ds.id = slot.doctor_service_id
        JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
        WHERE slot.id = NEW.slot_id
          AND slot.version = NEW.slot_version
          AND slot.clinic_location_id = NEW.location_id
          AND slot.service_id = NEW.service_id
          AND ds.id = NEW.doctor_service_id
          AND ds.clinic_location_id = NEW.location_id
          AND ds.service_id = NEW.service_id
          AND ds.doctor_id = NEW.doctor_id
          AND location.clinic_id = NEW.clinic_id
      ) THEN
        RAISE EXCEPTION 'REALLOCATION_OFFER_CANDIDATE_IDENTITY_INVALID' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER reallocation_offers_candidate_identity_trigger
      BEFORE INSERT OR UPDATE OF clinic_id, location_id, doctor_id, service_id,
        doctor_service_id, slot_id, slot_version
      ON booking_schema.reallocation_offers
      FOR EACH ROW EXECUTE FUNCTION booking_schema.enforce_reallocation_offer_candidate_identity();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS booking_schema.reallocation_offers;
    DROP TABLE IF EXISTS booking_schema.reallocation_cases;
    DROP FUNCTION IF EXISTS booking_schema.enforce_reallocation_offer_candidate_identity();
    DROP FUNCTION IF EXISTS booking_schema.enforce_reallocation_case_booking_identity();
  `);
};
