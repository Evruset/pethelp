/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS clinical_schema;

    ALTER TABLE pet_schema.pets
      ADD CONSTRAINT pets_clinical_owner_context_key UNIQUE (id, owner_id);

    CREATE TABLE clinical_schema.visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid NOT NULL,
      booking_hold_id uuid NOT NULL,
      owner_id uuid NOT NULL,
      pet_id uuid NOT NULL,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      slot_id uuid NOT NULL,
      completed_by uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'COMPLETED',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT visits_status_check CHECK (status = 'COMPLETED'),
      CONSTRAINT visits_time_check CHECK (completed_at >= created_at),
      CONSTRAINT visits_appointment_key UNIQUE (appointment_id),
      CONSTRAINT visits_booking_hold_key UNIQUE (booking_hold_id),
      CONSTRAINT visits_owner_pet_context_key UNIQUE (id, owner_id, pet_id),
      CONSTRAINT visits_context_key UNIQUE (id, owner_id, pet_id, clinic_id, location_id),
      CONSTRAINT visits_appointment_context_fkey
        FOREIGN KEY (appointment_id, booking_hold_id, owner_id, location_id, slot_id)
        REFERENCES booking_schema.appointments (id, hold_id, owner_id, clinic_location_id, slot_id)
        ON DELETE RESTRICT,
      CONSTRAINT visits_hold_context_fkey
        FOREIGN KEY (booking_hold_id, owner_id, slot_id)
        REFERENCES booking_schema.booking_holds (id, owner_id, slot_id)
        ON DELETE RESTRICT,
      CONSTRAINT visits_pet_owner_fkey
        FOREIGN KEY (pet_id, owner_id)
        REFERENCES pet_schema.pets (id, owner_id)
        ON DELETE RESTRICT,
      CONSTRAINT visits_slot_location_fkey
        FOREIGN KEY (slot_id, location_id)
        REFERENCES clinic_schema.appointment_slots (id, clinic_location_id)
        ON DELETE RESTRICT,
      CONSTRAINT visits_location_clinic_fkey
        FOREIGN KEY (location_id, clinic_id)
        REFERENCES clinic_schema.clinic_locations (id, clinic_id)
        ON DELETE RESTRICT
    );

    CREATE INDEX visits_clinic_location_time_idx
      ON clinical_schema.visits (clinic_id, location_id, completed_at DESC, id DESC);

    CREATE TABLE clinical_schema.visit_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      visit_id uuid NOT NULL,
      owner_id uuid NOT NULL,
      pet_id uuid NOT NULL,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      author_id uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'DRAFT',
      clinical_summary text NOT NULL,
      idempotency_key uuid NOT NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      published_at timestamptz,
      CONSTRAINT visit_results_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
      CONSTRAINT visit_results_content_check CHECK (char_length(btrim(clinical_summary)) BETWEEN 3 AND 8000),
      CONSTRAINT visit_results_version_check CHECK (version > 0),
      CONSTRAINT visit_results_time_check CHECK (
        updated_at >= created_at AND
        ((status = 'DRAFT' AND published_at IS NULL) OR
         (status = 'PUBLISHED' AND published_at IS NOT NULL AND published_at >= created_at))
      ),
      CONSTRAINT visit_results_context_fkey
        FOREIGN KEY (visit_id, owner_id, pet_id, clinic_id, location_id)
        REFERENCES clinical_schema.visits (id, owner_id, pet_id, clinic_id, location_id)
        ON DELETE RESTRICT,
      CONSTRAINT visit_results_idempotency_key UNIQUE (visit_id, idempotency_key),
      CONSTRAINT visit_results_context_key UNIQUE (id, visit_id, owner_id, pet_id, clinic_id, location_id)
    );

    CREATE INDEX visit_results_visit_status_idx
      ON clinical_schema.visit_results (visit_id, status, created_at DESC, id DESC);

    CREATE TABLE clinical_schema.visit_result_amendments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      result_id uuid NOT NULL,
      visit_id uuid NOT NULL,
      owner_id uuid NOT NULL,
      pet_id uuid NOT NULL,
      clinic_id uuid NOT NULL,
      location_id uuid NOT NULL,
      author_id uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE RESTRICT,
      amendment_content text NOT NULL,
      idempotency_key uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT visit_result_amendments_content_check
        CHECK (char_length(btrim(amendment_content)) BETWEEN 3 AND 8000),
      CONSTRAINT visit_result_amendments_time_check CHECK (published_at >= created_at),
      CONSTRAINT visit_result_amendments_result_context_fkey
        FOREIGN KEY (result_id, visit_id, owner_id, pet_id, clinic_id, location_id)
        REFERENCES clinical_schema.visit_results (id, visit_id, owner_id, pet_id, clinic_id, location_id)
        ON DELETE RESTRICT,
      CONSTRAINT visit_result_amendments_idempotency_key UNIQUE (result_id, idempotency_key),
      CONSTRAINT visit_result_amendments_context_key
        UNIQUE (id, result_id, visit_id, owner_id, pet_id, clinic_id, location_id)
    );

    CREATE INDEX visit_result_amendments_result_time_idx
      ON clinical_schema.visit_result_amendments (result_id, published_at ASC, id ASC);

    CREATE TABLE clinical_schema.diary_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL,
      pet_id uuid NOT NULL,
      visit_id uuid NOT NULL,
      source_result_id uuid,
      source_amendment_id uuid,
      occurred_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT diary_entries_one_source_check CHECK (
        (source_result_id IS NOT NULL)::integer + (source_amendment_id IS NOT NULL)::integer = 1
      ),
      CONSTRAINT diary_entries_time_check CHECK (occurred_at <= created_at),
      CONSTRAINT diary_entries_visit_context_fkey
        FOREIGN KEY (visit_id, owner_id, pet_id)
        REFERENCES clinical_schema.visits (id, owner_id, pet_id)
        ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX diary_entries_result_source_key
      ON clinical_schema.diary_entries (source_result_id) WHERE source_result_id IS NOT NULL;
    CREATE UNIQUE INDEX diary_entries_amendment_source_key
      ON clinical_schema.diary_entries (source_amendment_id) WHERE source_amendment_id IS NOT NULL;
    CREATE INDEX diary_entries_owner_pet_time_idx
      ON clinical_schema.diary_entries (owner_id, pet_id, occurred_at DESC, id DESC);
    CREATE INDEX diary_entries_pet_time_idx
      ON clinical_schema.diary_entries (pet_id, occurred_at, id);

    CREATE FUNCTION clinical_schema.protect_published_clinical_data()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME <> 'visit_results' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'PUBLISHED' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
      END IF;

      IF TG_TABLE_NAME = 'visit_results' THEN
        IF OLD.status = 'PUBLISHED' AND NEW IS DISTINCT FROM OLD THEN
          RAISE EXCEPTION 'W7A_PUBLISHED_RESULT_IMMUTABLE' USING ERRCODE = '23514';
        END IF;
      ELSE
        RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_PROJECTION' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;

    CREATE TRIGGER visit_results_immutability_trigger
      BEFORE UPDATE OR DELETE ON clinical_schema.visit_results
      FOR EACH ROW EXECUTE FUNCTION clinical_schema.protect_published_clinical_data();
    CREATE TRIGGER visit_result_amendments_immutability_trigger
      BEFORE UPDATE OR DELETE ON clinical_schema.visit_result_amendments
      FOR EACH ROW EXECUTE FUNCTION clinical_schema.protect_published_clinical_data();
    CREATE TRIGGER diary_entries_immutability_trigger
      BEFORE UPDATE OR DELETE ON clinical_schema.diary_entries
      FOR EACH ROW EXECUTE FUNCTION clinical_schema.protect_published_clinical_data();

    CREATE FUNCTION clinical_schema.enforce_publication_diary_coherence()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      target_result_id uuid;
      target_amendment_id uuid;
      source record;
      projection_count integer;
    BEGIN
      IF TG_TABLE_NAME = 'visit_results' THEN
        target_result_id := NEW.id;
      ELSIF TG_TABLE_NAME = 'visit_result_amendments' THEN
        target_result_id := NEW.result_id;
        target_amendment_id := NEW.id;
      ELSE
        target_result_id := NEW.source_result_id;
        target_amendment_id := NEW.source_amendment_id;
      END IF;

      IF target_amendment_id IS NOT NULL THEN
        SELECT a.id, a.result_id, a.visit_id, a.owner_id, a.pet_id, a.clinic_id, a.location_id,
               r.status result_status
          INTO source
          FROM clinical_schema.visit_result_amendments a
          JOIN clinical_schema.visit_results r ON r.id = a.result_id
         WHERE a.id = target_amendment_id;
        IF source.id IS NULL OR source.result_status <> 'PUBLISHED' THEN
          RAISE EXCEPTION 'W7A_AMENDMENT_SOURCE_INVALID' USING ERRCODE = '23514';
        END IF;
        SELECT count(*)::integer INTO projection_count
          FROM clinical_schema.diary_entries d
         WHERE d.source_amendment_id = target_amendment_id
           AND d.source_result_id IS NULL AND d.visit_id = source.visit_id
           AND d.owner_id = source.owner_id AND d.pet_id = source.pet_id;
        IF projection_count <> 1 THEN
          RAISE EXCEPTION 'W7A_AMENDMENT_DIARY_COHERENCE_INVALID' USING ERRCODE = '23514';
        END IF;
      ELSIF target_result_id IS NOT NULL THEN
        SELECT r.id, r.visit_id, r.owner_id, r.pet_id, r.status INTO source
          FROM clinical_schema.visit_results r WHERE r.id = target_result_id;
        IF source.id IS NULL THEN
          RAISE EXCEPTION 'W7A_RESULT_SOURCE_INVALID' USING ERRCODE = '23514';
        END IF;
        SELECT count(*)::integer INTO projection_count
          FROM clinical_schema.diary_entries d
         WHERE d.source_result_id = target_result_id
           AND d.source_amendment_id IS NULL AND d.visit_id = source.visit_id
           AND d.owner_id = source.owner_id AND d.pet_id = source.pet_id;
        IF (source.status = 'PUBLISHED' AND projection_count <> 1)
          OR (source.status = 'DRAFT' AND projection_count <> 0) THEN
          RAISE EXCEPTION 'W7A_RESULT_DIARY_COHERENCE_INVALID' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END $$;

    CREATE CONSTRAINT TRIGGER visit_results_diary_coherence_trigger
      AFTER INSERT OR UPDATE OF status, published_at ON clinical_schema.visit_results
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION clinical_schema.enforce_publication_diary_coherence();
    CREATE CONSTRAINT TRIGGER visit_result_amendments_diary_coherence_trigger
      AFTER INSERT ON clinical_schema.visit_result_amendments
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION clinical_schema.enforce_publication_diary_coherence();
    CREATE CONSTRAINT TRIGGER diary_entries_source_coherence_trigger
      AFTER INSERT ON clinical_schema.diary_entries
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION clinical_schema.enforce_publication_diary_coherence();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM clinical_schema.visits)
        OR EXISTS (SELECT 1 FROM clinical_schema.visit_results)
        OR EXISTS (SELECT 1 FROM clinical_schema.visit_result_amendments)
        OR EXISTS (SELECT 1 FROM clinical_schema.diary_entries) THEN
        RAISE EXCEPTION 'W7A_DOWN_DATA_REMEDIATION_APPROVAL_REQUIRED';
      END IF;
    END $$;

    DROP TABLE clinical_schema.diary_entries;
    DROP TABLE clinical_schema.visit_result_amendments;
    DROP TABLE clinical_schema.visit_results;
    DROP TABLE clinical_schema.visits;
    DROP FUNCTION clinical_schema.enforce_publication_diary_coherence();
    DROP FUNCTION clinical_schema.protect_published_clinical_data();
    ALTER TABLE pet_schema.pets DROP CONSTRAINT pets_clinical_owner_context_key;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'clinical_schema'
      ) THEN
        DROP SCHEMA clinical_schema;
      END IF;
    END $$;
  `);
};
