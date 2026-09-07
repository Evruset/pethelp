/* eslint-disable */
exports.shorthands = undefined;

/*
 * Approved Wave 3 additive schema. node-pg-migrate runs this migration in one
 * transaction. The composite indexes scan existing clinic tables, so rollout
 * must use a maintenance window sized for those tables.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    ALTER TABLE clinic_schema.clinic_locations
      ADD COLUMN IF NOT EXISTS timezone text;
    UPDATE clinic_schema.clinic_locations AS location
    SET timezone = clinic.timezone
    FROM clinic_schema.clinics AS clinic
    WHERE clinic.id = location.clinic_id
      AND location.timezone IS NULL;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM clinic_schema.clinic_locations WHERE timezone IS NULL) THEN
        RAISE EXCEPTION 'clinic location timezone backfill is incomplete';
      END IF;
    END $$;
    ALTER TABLE clinic_schema.clinic_locations
      DROP CONSTRAINT IF EXISTS clinic_locations_timezone_check,
      ADD CONSTRAINT clinic_locations_timezone_check
        CHECK (length(btrim(timezone)) BETWEEN 1 AND 63) NOT VALID;
    ALTER TABLE clinic_schema.clinic_locations
      VALIDATE CONSTRAINT clinic_locations_timezone_check;
    ALTER TABLE clinic_schema.clinic_locations
      ALTER COLUMN timezone SET NOT NULL;

    ALTER TABLE clinic_schema.clinic_locations
      ADD CONSTRAINT clinic_locations_id_clinic_id_key UNIQUE (id, clinic_id);
    ALTER TABLE clinic_schema.clinic_staff
      ADD CONSTRAINT clinic_staff_id_location_key UNIQUE (id, clinic_location_id);
    ALTER TABLE clinic_schema.clinic_services
      ADD CONSTRAINT clinic_services_id_location_key UNIQUE (id, clinic_location_id);
    ALTER TABLE clinic_schema.clinic_resources
      ADD CONSTRAINT clinic_resources_id_location_key UNIQUE (id, clinic_location_id);
    ALTER TABLE catalog_schema.doctors
      ADD CONSTRAINT doctors_id_location_key UNIQUE (id, clinic_location_id);

    ALTER TABLE clinic_schema.clinic_staff
      ADD COLUMN IF NOT EXISTS catalog_doctor_id uuid;
    ALTER TABLE clinic_schema.clinic_staff
      ADD CONSTRAINT clinic_staff_catalog_doctor_location_fkey
      FOREIGN KEY (catalog_doctor_id, clinic_location_id)
      REFERENCES catalog_schema.doctors (id, clinic_location_id)
      ON DELETE RESTRICT NOT VALID;
    ALTER TABLE clinic_schema.clinic_staff
      VALIDATE CONSTRAINT clinic_staff_catalog_doctor_location_fkey;
    CREATE UNIQUE INDEX clinic_staff_catalog_doctor_unique_idx
      ON clinic_schema.clinic_staff (catalog_doctor_id)
      WHERE catalog_doctor_id IS NOT NULL;
    ALTER TABLE clinic_schema.clinic_staff
      ADD CONSTRAINT clinic_staff_bridge_key
      UNIQUE (id, catalog_doctor_id, clinic_location_id);

    CREATE TABLE clinic_schema.doctor_services (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_location_id uuid NOT NULL,
      staff_id uuid NOT NULL,
      doctor_id uuid NOT NULL,
      service_id uuid NOT NULL,
      resource_id uuid,
      slot_capacity integer NOT NULL DEFAULT 1,
      active boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT doctor_services_location_fkey
        FOREIGN KEY (clinic_location_id) REFERENCES clinic_schema.clinic_locations (id) ON DELETE RESTRICT,
      CONSTRAINT doctor_services_staff_doctor_location_fkey
        FOREIGN KEY (staff_id, doctor_id, clinic_location_id)
        REFERENCES clinic_schema.clinic_staff (id, catalog_doctor_id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_services_service_location_fkey
        FOREIGN KEY (service_id, clinic_location_id)
        REFERENCES clinic_schema.clinic_services (id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_services_resource_location_fkey
        FOREIGN KEY (resource_id, clinic_location_id)
        REFERENCES clinic_schema.clinic_resources (id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_services_slot_capacity_check CHECK (slot_capacity = 1),
      CONSTRAINT doctor_services_version_check CHECK (version > 0),
      UNIQUE NULLS NOT DISTINCT (clinic_location_id, doctor_id, service_id, resource_id)
    );
    CREATE INDEX doctor_services_location_active_idx
      ON clinic_schema.doctor_services (clinic_location_id, active, doctor_id, service_id);
    CREATE INDEX doctor_services_doctor_active_idx
      ON clinic_schema.doctor_services (doctor_id, active, service_id);

    CREATE TABLE clinic_schema.doctor_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics (id) ON DELETE RESTRICT,
      clinic_location_id uuid NOT NULL,
      staff_id uuid NOT NULL,
      doctor_id uuid NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      timezone text NOT NULL,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version integer NOT NULL DEFAULT 1,
      generation_version integer NOT NULL DEFAULT 0,
      created_by uuid NOT NULL,
      updated_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT doctor_shifts_location_clinic_fkey
        FOREIGN KEY (clinic_location_id, clinic_id)
        REFERENCES clinic_schema.clinic_locations (id, clinic_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_shifts_staff_doctor_location_fkey
        FOREIGN KEY (staff_id, doctor_id, clinic_location_id)
        REFERENCES clinic_schema.clinic_staff (id, catalog_doctor_id, clinic_location_id) ON DELETE RESTRICT,
      CONSTRAINT doctor_shifts_bounds_check
        CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '24 hours'),
      CONSTRAINT doctor_shifts_timezone_check CHECK (length(btrim(timezone)) BETWEEN 1 AND 63),
      CONSTRAINT doctor_shifts_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'BLOCKED', 'CANCELLED')),
      CONSTRAINT doctor_shifts_versions_check CHECK (aggregate_version > 0 AND generation_version >= 0),
      CONSTRAINT doctor_shifts_no_overlap
        EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
        WHERE (status <> 'CANCELLED')
    );
    CREATE INDEX doctor_shifts_location_time_idx
      ON clinic_schema.doctor_shifts (clinic_location_id, starts_at, ends_at, status);
    CREATE INDEX doctor_shifts_doctor_time_idx
      ON clinic_schema.doctor_shifts (doctor_id, starts_at, ends_at);
    CREATE INDEX doctor_shifts_clinic_location_status_idx
      ON clinic_schema.doctor_shifts (clinic_id, clinic_location_id, status);

    CREATE TABLE clinic_schema.inventory_generation_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_shift_id uuid NOT NULL REFERENCES clinic_schema.doctor_shifts (id) ON DELETE RESTRICT,
      shift_version integer NOT NULL,
      generation_version integer NOT NULL,
      rules_fingerprint char(64) NOT NULL,
      input_snapshot jsonb NOT NULL,
      status text NOT NULL DEFAULT 'GENERATING',
      slot_count integer NOT NULL DEFAULT 0,
      attempt_count integer NOT NULL DEFAULT 1,
      error_code text,
      created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      completed_at timestamptz,
      CONSTRAINT inventory_generation_runs_versions_check CHECK (shift_version > 0 AND generation_version > 0),
      CONSTRAINT inventory_generation_runs_fingerprint_check CHECK (rules_fingerprint ~ '^[0-9a-f]{64}$'),
      CONSTRAINT inventory_generation_runs_snapshot_check CHECK (jsonb_typeof(input_snapshot) = 'object'),
      CONSTRAINT inventory_generation_runs_status_check CHECK (status IN ('GENERATING', 'GENERATED', 'PUBLISHED', 'SUPERSEDED', 'FAILED')),
      CONSTRAINT inventory_generation_runs_counts_check CHECK (slot_count >= 0 AND attempt_count > 0),
      CONSTRAINT inventory_generation_runs_completion_check CHECK (
        (status = 'GENERATING' AND completed_at IS NULL AND error_code IS NULL)
        OR (status IN ('GENERATED', 'PUBLISHED', 'SUPERSEDED') AND completed_at IS NOT NULL AND error_code IS NULL)
        OR (status = 'FAILED' AND completed_at IS NOT NULL AND error_code IS NOT NULL)
      ),
      UNIQUE (doctor_shift_id, generation_version),
      UNIQUE (doctor_shift_id, shift_version, rules_fingerprint)
    );

    ALTER TABLE clinic_schema.appointment_slots
      ADD COLUMN IF NOT EXISTS doctor_shift_id uuid REFERENCES clinic_schema.doctor_shifts (id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS doctor_service_id uuid REFERENCES clinic_schema.doctor_services (id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS generation_run_id uuid REFERENCES clinic_schema.inventory_generation_runs (id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS generation_version integer,
      ADD COLUMN IF NOT EXISTS duration_minutes_snapshot integer,
      ADD COLUMN IF NOT EXISTS publication_state text,
      ADD COLUMN IF NOT EXISTS published_at timestamptz,
      ADD COLUMN IF NOT EXISTS unpublished_at timestamptz,
      ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
      ADD COLUMN IF NOT EXISTS source_stale_at timestamptz;

    UPDATE clinic_schema.appointment_slots
    SET publication_state = 'PUBLISHED'
    WHERE publication_state IS NULL;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM clinic_schema.appointment_slots WHERE publication_state IS NULL) THEN
        RAISE EXCEPTION 'appointment slot publication-state backfill is incomplete';
      END IF;
    END $$;
    ALTER TABLE clinic_schema.appointment_slots
      ALTER COLUMN publication_state SET DEFAULT 'PUBLISHED',
      ALTER COLUMN publication_state SET NOT NULL;

    ALTER TABLE clinic_schema.appointment_slots
      ADD CONSTRAINT appointment_slots_generation_lineage_check CHECK (
        (source = 'DOCTOR_SHIFT'
          AND doctor_shift_id IS NOT NULL
          AND doctor_service_id IS NOT NULL
          AND generation_run_id IS NOT NULL
          AND generation_version > 0
          AND duration_minutes_snapshot BETWEEN 5 AND 480
          AND capacity = 1)
        OR (source <> 'DOCTOR_SHIFT'
          AND doctor_shift_id IS NULL
          AND doctor_service_id IS NULL
          AND generation_run_id IS NULL
          AND generation_version IS NULL
          AND duration_minutes_snapshot IS NULL)
      ) NOT VALID,
      ADD CONSTRAINT appointment_slots_publication_state_check CHECK (
        publication_state IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'BLOCKED', 'STALE_SOURCE')
      ) NOT VALID,
      ADD CONSTRAINT appointment_slots_publication_timestamps_check CHECK (
        (publication_state = 'PUBLISHED' AND state = 'OPEN' AND published_at IS NOT NULL
          AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'DRAFT' AND published_at IS NULL
          AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'UNPUBLISHED' AND unpublished_at IS NOT NULL
          AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'BLOCKED' AND blocked_at IS NOT NULL AND source_stale_at IS NULL)
        OR (publication_state = 'STALE_SOURCE' AND source_stale_at IS NOT NULL AND blocked_at IS NULL)
        OR (source <> 'DOCTOR_SHIFT' AND publication_state = 'PUBLISHED')
      ) NOT VALID;
    ALTER TABLE clinic_schema.appointment_slots
      VALIDATE CONSTRAINT appointment_slots_generation_lineage_check;
    ALTER TABLE clinic_schema.appointment_slots
      VALIDATE CONSTRAINT appointment_slots_publication_state_check;
    ALTER TABLE clinic_schema.appointment_slots
      VALIDATE CONSTRAINT appointment_slots_publication_timestamps_check;

    CREATE UNIQUE INDEX appointment_slots_generation_candidate_key
      ON clinic_schema.appointment_slots (generation_run_id, doctor_service_id, starts_at)
      WHERE generation_run_id IS NOT NULL;
    CREATE INDEX appointment_slots_shift_generation_time_idx
      ON clinic_schema.appointment_slots (doctor_shift_id, generation_version, starts_at)
      WHERE doctor_shift_id IS NOT NULL;
    CREATE INDEX appointment_slots_owner_published_idx
      ON clinic_schema.appointment_slots (clinic_location_id, service_id, starts_at, id)
      WHERE publication_state = 'PUBLISHED' AND state = 'OPEN';

    ANALYZE clinic_schema.clinic_locations;
    ANALYZE clinic_schema.clinic_staff;
    ANALYZE clinic_schema.doctor_services;
    ANALYZE clinic_schema.doctor_shifts;
    ANALYZE clinic_schema.inventory_generation_runs;
    ANALYZE clinic_schema.appointment_slots;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM clinic_schema.doctor_services)
        OR EXISTS (SELECT 1 FROM clinic_schema.doctor_shifts)
        OR EXISTS (SELECT 1 FROM clinic_schema.inventory_generation_runs)
        OR EXISTS (SELECT 1 FROM clinic_schema.clinic_staff WHERE catalog_doctor_id IS NOT NULL)
        OR EXISTS (SELECT 1 FROM clinic_schema.appointment_slots WHERE source = 'DOCTOR_SHIFT' OR doctor_shift_id IS NOT NULL)
      THEN
        RAISE EXCEPTION 'Wave 3 data exists; destructive DoctorShift schema rollback is refused';
      END IF;
    END $$;

    DROP INDEX IF EXISTS clinic_schema.appointment_slots_owner_published_idx;
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_shift_generation_time_idx;
    DROP INDEX IF EXISTS clinic_schema.appointment_slots_generation_candidate_key;
    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT IF EXISTS appointment_slots_publication_timestamps_check,
      DROP CONSTRAINT IF EXISTS appointment_slots_publication_state_check,
      DROP CONSTRAINT IF EXISTS appointment_slots_generation_lineage_check,
      DROP COLUMN IF EXISTS source_stale_at,
      DROP COLUMN IF EXISTS blocked_at,
      DROP COLUMN IF EXISTS unpublished_at,
      DROP COLUMN IF EXISTS published_at,
      DROP COLUMN IF EXISTS publication_state,
      DROP COLUMN IF EXISTS duration_minutes_snapshot,
      DROP COLUMN IF EXISTS generation_version,
      DROP COLUMN IF EXISTS generation_run_id,
      DROP COLUMN IF EXISTS doctor_service_id,
      DROP COLUMN IF EXISTS doctor_shift_id;

    DROP TABLE IF EXISTS clinic_schema.inventory_generation_runs;
    DROP TABLE IF EXISTS clinic_schema.doctor_shifts;
    DROP TABLE IF EXISTS clinic_schema.doctor_services;

    DROP INDEX IF EXISTS clinic_schema.clinic_staff_catalog_doctor_unique_idx;
    ALTER TABLE clinic_schema.clinic_staff
      DROP CONSTRAINT IF EXISTS clinic_staff_catalog_doctor_location_fkey,
      DROP CONSTRAINT IF EXISTS clinic_staff_bridge_key,
      DROP COLUMN IF EXISTS catalog_doctor_id;

    ALTER TABLE catalog_schema.doctors DROP CONSTRAINT IF EXISTS doctors_id_location_key;
    ALTER TABLE clinic_schema.clinic_resources DROP CONSTRAINT IF EXISTS clinic_resources_id_location_key;
    ALTER TABLE clinic_schema.clinic_services DROP CONSTRAINT IF EXISTS clinic_services_id_location_key;
    ALTER TABLE clinic_schema.clinic_staff DROP CONSTRAINT IF EXISTS clinic_staff_id_location_key;
    ALTER TABLE clinic_schema.clinic_locations
      DROP CONSTRAINT IF EXISTS clinic_locations_id_clinic_id_key,
      DROP CONSTRAINT IF EXISTS clinic_locations_timezone_check,
      DROP COLUMN IF EXISTS timezone;
  `);
};
