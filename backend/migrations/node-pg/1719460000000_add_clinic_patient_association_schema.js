/* eslint-disable */
exports.shorthands = undefined;

/*
 * V50-CLINIC-03A3 creates only empty patient-association structures.
 * node-pg-migrate runs this repository with --single-transaction; the indexes
 * are therefore intentionally transactional and not CONCURRENTLY.
 *
 * Future writers must acquire one transaction advisory lock derived from the
 * canonical clinic/location/pet tuple before validating consent and changing
 * an association. Appointment and location business-scope equality remains an
 * application invariant because the applied master tables expose no matching
 * composite candidate keys.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clinic_schema.clinic_patient_consents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE NO ACTION,
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id) ON DELETE NO ACTION,
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id) ON DELETE NO ACTION,
      subject_owner_id uuid REFERENCES identity_schema.users(id) ON DELETE NO ACTION,
      purpose text NOT NULL,
      consent_version text NOT NULL,
      source text NOT NULL,
      actor_type text NOT NULL,
      actor_id text,
      granted_at timestamptz NOT NULL,
      expires_at timestamptz,
      revoked_at timestamptz,
      revoked_by_actor_type text,
      revoked_by_actor_id text,
      revoke_reason text,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT clinic_patient_consents_purpose_check
        CHECK (purpose = 'PATIENT_ADMIN_REGISTRY'),
      CONSTRAINT clinic_patient_consents_version_check CHECK (version > 0),
      CONSTRAINT clinic_patient_consents_text_check
        CHECK (btrim(consent_version) <> '' AND btrim(source) <> '' AND btrim(actor_type) <> ''),
      CONSTRAINT clinic_patient_consents_dates_check
        CHECK (
          (expires_at IS NULL OR expires_at > granted_at)
          AND (revoked_at IS NULL OR revoked_at >= granted_at)
          AND updated_at >= created_at
        ),
      CONSTRAINT clinic_patient_consents_revocation_check
        CHECK (
          (revoked_at IS NULL
            AND revoked_by_actor_type IS NULL
            AND revoked_by_actor_id IS NULL
            AND revoke_reason IS NULL)
          OR
          (revoked_at IS NOT NULL
            AND revoked_by_actor_type IS NOT NULL
            AND btrim(revoked_by_actor_type) <> ''
            AND revoked_by_actor_id IS NOT NULL
            AND btrim(revoked_by_actor_id) <> ''
            AND revoke_reason IS NOT NULL
            AND btrim(revoke_reason) <> '')
        ),
      CONSTRAINT clinic_patient_consents_scope_key
        UNIQUE (id, clinic_id, clinic_location_id, pet_id)
    );

    CREATE TABLE clinic_schema.clinic_patient_associations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE NO ACTION,
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id) ON DELETE NO ACTION,
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id) ON DELETE NO ACTION,
      status text NOT NULL,
      source_type text NOT NULL,
      source_appointment_id uuid NOT NULL REFERENCES booking_schema.appointments(id) ON DELETE NO ACTION,
      current_consent_id uuid NOT NULL,
      visibility_policy_version text NOT NULL,
      visibility_expires_at timestamptz NOT NULL,
      first_qualified_at timestamptz NOT NULL,
      last_qualified_at timestamptz NOT NULL,
      archived_at timestamptz,
      archive_reason text,
      revoked_at timestamptz,
      revoke_reason text,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT clinic_patient_associations_scope_key
        UNIQUE (clinic_id, clinic_location_id, pet_id),
      CONSTRAINT clinic_patient_associations_consent_scope_fkey
        FOREIGN KEY (current_consent_id, clinic_id, clinic_location_id, pet_id)
        REFERENCES clinic_schema.clinic_patient_consents
          (id, clinic_id, clinic_location_id, pet_id)
        ON DELETE NO ACTION,
      CONSTRAINT clinic_patient_associations_status_check
        CHECK (status IN ('ACTIVE', 'ARCHIVED', 'REVOKED')),
      CONSTRAINT clinic_patient_associations_source_check
        CHECK (source_type = 'APPOINTMENT'),
      CONSTRAINT clinic_patient_associations_version_check CHECK (version > 0),
      CONSTRAINT clinic_patient_associations_text_check
        CHECK (btrim(visibility_policy_version) <> ''),
      CONSTRAINT clinic_patient_associations_dates_check
        CHECK (
          last_qualified_at >= first_qualified_at
          AND visibility_expires_at >= first_qualified_at
          AND updated_at >= created_at
        ),
      CONSTRAINT clinic_patient_associations_lifecycle_check
        CHECK (
          (status = 'ACTIVE'
            AND archived_at IS NULL AND archive_reason IS NULL
            AND revoked_at IS NULL AND revoke_reason IS NULL)
          OR
          (status = 'ARCHIVED'
            AND archived_at IS NOT NULL
            AND archive_reason IS NOT NULL AND btrim(archive_reason) <> ''
            AND revoked_at IS NULL AND revoke_reason IS NULL)
          OR
          (status = 'REVOKED'
            AND revoked_at IS NOT NULL
            AND revoke_reason IS NOT NULL AND btrim(revoke_reason) <> ''
            AND ((archived_at IS NULL AND archive_reason IS NULL)
              OR (archived_at IS NOT NULL
                AND archive_reason IS NOT NULL AND btrim(archive_reason) <> '')))
        )
    );

    CREATE TABLE clinic_schema.clinic_patient_association_event_receipts (
      source_event_id uuid PRIMARY KEY,
      association_id uuid NOT NULL
        REFERENCES clinic_schema.clinic_patient_associations(id) ON DELETE NO ACTION,
      source_aggregate_id uuid NOT NULL
        REFERENCES booking_schema.appointments(id) ON DELETE NO ACTION,
      source_aggregate_version integer NOT NULL,
      event_type text NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT clinic_patient_association_receipts_version_check
        CHECK (source_aggregate_version > 0),
      CONSTRAINT clinic_patient_association_receipts_event_type_check
        CHECK (btrim(event_type) <> ''),
      CONSTRAINT clinic_patient_association_receipts_semantic_key
        UNIQUE (source_aggregate_id, source_aggregate_version, event_type)
    );

    CREATE SEQUENCE clinic_schema.clinic_patient_association_revision_sequence;

    CREATE TABLE clinic_schema.clinic_patient_association_revisions (
      revision_sequence bigint PRIMARY KEY
        DEFAULT nextval('clinic_schema.clinic_patient_association_revision_sequence'),
      association_id uuid NOT NULL
        REFERENCES clinic_schema.clinic_patient_associations(id) ON DELETE NO ACTION,
      association_version integer NOT NULL,
      clinic_id uuid NOT NULL REFERENCES clinic_schema.clinics(id) ON DELETE NO ACTION,
      clinic_location_id uuid NOT NULL
        REFERENCES clinic_schema.clinic_locations(id) ON DELETE NO ACTION,
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id) ON DELETE NO ACTION,
      status text NOT NULL,
      source_type text NOT NULL,
      source_appointment_id uuid NOT NULL
        REFERENCES booking_schema.appointments(id) ON DELETE NO ACTION,
      current_consent_id uuid NOT NULL,
      visibility_expires_at timestamptz NOT NULL,
      last_qualified_at timestamptz NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT clinic_patient_association_revisions_association_version_key
        UNIQUE (association_id, association_version),
      CONSTRAINT clinic_patient_association_revisions_consent_scope_fkey
        FOREIGN KEY (current_consent_id, clinic_id, clinic_location_id, pet_id)
        REFERENCES clinic_schema.clinic_patient_consents
          (id, clinic_id, clinic_location_id, pet_id)
        ON DELETE NO ACTION,
      CONSTRAINT clinic_patient_association_revisions_version_check
        CHECK (association_version > 0),
      CONSTRAINT clinic_patient_association_revisions_status_check
        CHECK (status IN ('ACTIVE', 'ARCHIVED', 'REVOKED')),
      CONSTRAINT clinic_patient_association_revisions_source_check
        CHECK (source_type = 'APPOINTMENT')
    );

    ALTER SEQUENCE clinic_schema.clinic_patient_association_revision_sequence
      OWNED BY clinic_schema.clinic_patient_association_revisions.revision_sequence;

    CREATE INDEX clinic_patient_associations_registry_idx
      ON clinic_schema.clinic_patient_associations
        (clinic_id, clinic_location_id, status, last_qualified_at DESC, pet_id DESC);

    CREATE INDEX clinic_patient_consents_scope_purpose_idx
      ON clinic_schema.clinic_patient_consents
        (clinic_id, clinic_location_id, pet_id, purpose, granted_at DESC);

    CREATE INDEX clinic_patient_consents_revocation_idx
      ON clinic_schema.clinic_patient_consents (id, revoked_at);

    CREATE INDEX clinic_patient_association_receipts_association_idx
      ON clinic_schema.clinic_patient_association_event_receipts
        (association_id, processed_at DESC);

    CREATE INDEX clinic_patient_association_revisions_snapshot_idx
      ON clinic_schema.clinic_patient_association_revisions
        (clinic_id, clinic_location_id, association_id, revision_sequence DESC);

    CREATE INDEX clinic_patient_association_revisions_registry_idx
      ON clinic_schema.clinic_patient_association_revisions
        (clinic_id, clinic_location_id, status, last_qualified_at DESC, pet_id DESC,
         revision_sequence);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_association_revisions_registry_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_association_revisions_snapshot_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_association_receipts_association_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_consents_revocation_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_consents_scope_purpose_idx;
    DROP INDEX IF EXISTS clinic_schema.clinic_patient_associations_registry_idx;

    DROP TABLE IF EXISTS clinic_schema.clinic_patient_association_revisions;
    DROP SEQUENCE IF EXISTS clinic_schema.clinic_patient_association_revision_sequence;
    DROP TABLE IF EXISTS clinic_schema.clinic_patient_association_event_receipts;
    DROP TABLE IF EXISTS clinic_schema.clinic_patient_associations;
    DROP TABLE IF EXISTS clinic_schema.clinic_patient_consents;
  `);
};
