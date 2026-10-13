exports.shorthands = undefined;
exports.up = (pgm) => pgm.sql(`
  CREATE SCHEMA medical_schema;
  ALTER TABLE booking_schema.appointments ADD CONSTRAINT appointments_medical_context_key UNIQUE(id,owner_id,pet_id,clinic_location_id);
  ALTER TABLE clinic_schema.clinic_locations ADD CONSTRAINT clinic_locations_medical_context_key UNIQUE(id,clinic_id);
  ALTER TABLE clinical_schema.visit_results ADD CONSTRAINT results_medical_owner_key UNIQUE(id,owner_id,pet_id);
  ALTER TABLE clinical_schema.visit_result_amendments ADD CONSTRAINT amendments_medical_owner_key UNIQUE(id,owner_id,pet_id);
  ALTER TABLE pet_schema.pet_documents ADD CONSTRAINT documents_medical_owner_key UNIQUE(id,owner_id,pet_id);
  CREATE TABLE medical_schema.appointment_data_shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
    clinic_id uuid NOT NULL, location_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','REVOKED')),
    version integer NOT NULL DEFAULT 1 CHECK(version>0),
    idempotency_key uuid NOT NULL, request_json jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    correlation_id uuid NOT NULL,
    revoked_at timestamptz, revoke_idempotency_key uuid, revoke_expected_version integer,
    UNIQUE(owner_id,idempotency_key), UNIQUE(id,owner_id,pet_id),
    FOREIGN KEY(appointment_id,owner_id,pet_id,location_id) REFERENCES booking_schema.appointments(id,owner_id,pet_id,clinic_location_id),
    FOREIGN KEY(location_id,clinic_id) REFERENCES clinic_schema.clinic_locations(id,clinic_id),
    CHECK((status='ACTIVE' AND version=1 AND revoked_at IS NULL AND revoke_idempotency_key IS NULL AND revoke_expected_version IS NULL)
      OR (status='REVOKED' AND version=2 AND revoked_at IS NOT NULL AND revoked_at>=created_at AND revoke_idempotency_key IS NOT NULL AND revoke_expected_version=1))
  );
  CREATE TABLE medical_schema.appointment_data_share_resources (
    share_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
    resource_type text NOT NULL CHECK(resource_type IN('RESULT','AMENDMENT','DOCUMENT')),
    resource_id uuid NOT NULL,
    result_id uuid, amendment_id uuid, document_id uuid,
    PRIMARY KEY(share_id,resource_type,resource_id),
    FOREIGN KEY(share_id,owner_id,pet_id) REFERENCES medical_schema.appointment_data_shares(id,owner_id,pet_id),
    FOREIGN KEY(result_id,owner_id,pet_id) REFERENCES clinical_schema.visit_results(id,owner_id,pet_id),
    FOREIGN KEY(amendment_id,owner_id,pet_id) REFERENCES clinical_schema.visit_result_amendments(id,owner_id,pet_id),
    FOREIGN KEY(document_id,owner_id,pet_id) REFERENCES pet_schema.pet_documents(id,owner_id,pet_id),
    CHECK((resource_type='RESULT' AND result_id=resource_id AND result_id IS NOT NULL AND amendment_id IS NULL AND document_id IS NULL)
      OR (resource_type='AMENDMENT' AND amendment_id=resource_id AND amendment_id IS NOT NULL AND result_id IS NULL AND document_id IS NULL)
      OR (resource_type='DOCUMENT' AND document_id=resource_id AND document_id IS NOT NULL AND result_id IS NULL AND amendment_id IS NULL))
  );
  CREATE INDEX appointment_data_shares_read_idx ON medical_schema.appointment_data_shares(appointment_id,clinic_id,location_id) WHERE status='ACTIVE';
  CREATE TABLE medical_schema.share_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),share_id uuid NOT NULL REFERENCES medical_schema.appointment_data_shares(id),
    event_type text NOT NULL CHECK(event_type IN('medical.share.granted','medical.share.revoked')),
    actor_id uuid NOT NULL REFERENCES identity_schema.users(id),correlation_id uuid NOT NULL,
    resource_refs jsonb NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(share_id,event_type)
  );
  CREATE FUNCTION medical_schema.protect_sharing_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME<>'appointment_data_shares' THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
    IF OLD.status<>'ACTIVE' OR NEW.status<>'REVOKED' OR NEW.version<>OLD.version+1
      OR (to_jsonb(NEW)-ARRAY['status','version','revoked_at','revoke_idempotency_key','revoke_expected_version']) IS DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['status','version','revoked_at','revoke_idempotency_key','revoke_expected_version'])
    THEN RAISE EXCEPTION 'MEDICAL_SHARE_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER shares_immutable BEFORE UPDATE OR DELETE ON medical_schema.appointment_data_shares FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
  CREATE TRIGGER share_resources_immutable BEFORE UPDATE OR DELETE ON medical_schema.appointment_data_share_resources FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
  CREATE TRIGGER share_events_immutable BEFORE UPDATE OR DELETE ON medical_schema.share_events FOR EACH ROW EXECUTE FUNCTION medical_schema.protect_sharing_evidence();
  CREATE FUNCTION medical_schema.validate_share_resource() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.resource_type='RESULT' AND NOT EXISTS(SELECT 1 FROM clinical_schema.visit_results WHERE id=NEW.result_id AND status='PUBLISHED')
      THEN RAISE EXCEPTION 'MEDICAL_RESOURCE_NOT_ELIGIBLE' USING ERRCODE='23514'; END IF;
    IF NEW.resource_type='DOCUMENT' AND NOT EXISTS(SELECT 1 FROM pet_schema.pet_documents WHERE id=NEW.document_id AND doc_type IN('PASSPORT','HISTORY'))
      THEN RAISE EXCEPTION 'MEDICAL_RESOURCE_NOT_ELIGIBLE' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM medical_schema.appointment_data_shares WHERE id=NEW.share_id AND status='ACTIVE')
      THEN RAISE EXCEPTION 'MEDICAL_SHARE_NOT_ACTIVE' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM medical_schema.share_events WHERE share_id=NEW.share_id AND event_type='medical.share.granted')
      THEN RAISE EXCEPTION 'MEDICAL_SHARE_SNAPSHOT_SEALED' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER share_resources_validate BEFORE INSERT ON medical_schema.appointment_data_share_resources FOR EACH ROW EXECUTE FUNCTION medical_schema.validate_share_resource();
`);
exports.down = (pgm) => pgm.sql(`
  DO $$ BEGIN IF EXISTS(SELECT 1 FROM medical_schema.appointment_data_shares) THEN RAISE EXCEPTION 'WAVE4_MEDICAL_SHARE_ROLLBACK_APPROVAL_REQUIRED'; END IF; END $$;
  DROP TABLE medical_schema.share_events;
  DROP TABLE medical_schema.appointment_data_share_resources;
  DROP TABLE medical_schema.appointment_data_shares;
  DROP FUNCTION medical_schema.validate_share_resource();
  DROP FUNCTION medical_schema.protect_sharing_evidence();
  DROP SCHEMA medical_schema;
  ALTER TABLE pet_schema.pet_documents DROP CONSTRAINT documents_medical_owner_key;
  ALTER TABLE clinical_schema.visit_result_amendments DROP CONSTRAINT amendments_medical_owner_key;
  ALTER TABLE clinical_schema.visit_results DROP CONSTRAINT results_medical_owner_key;
  ALTER TABLE clinic_schema.clinic_locations DROP CONSTRAINT clinic_locations_medical_context_key;
  ALTER TABLE booking_schema.appointments DROP CONSTRAINT appointments_medical_context_key;
`);
