/* Byte storage authority only. Actual OCR attestation remains disabled in03A-01. */
exports.up=pgm=>pgm.sql(`
 ALTER TABLE pet_schema.ocr_jobs ADD COLUMN byte_source_creation_xid xid8;
 CREATE FUNCTION pet_schema.ocr_creation_witness() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF TG_OP='INSERT' THEN NEW.byte_source_creation_xid:=pg_current_xact_id();
  ELSIF NEW.byte_source_creation_xid IS DISTINCT FROM OLD.byte_source_creation_xid THEN RAISE EXCEPTION 'OCR creation witness immutable'; END IF;
  RETURN NEW;
 END $$;
 CREATE TRIGGER ocr_creation_witness BEFORE INSERT OR UPDATE ON pet_schema.ocr_jobs FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_creation_witness();
 CREATE TABLE pet_schema.document_byte_versions(
  version_id uuid PRIMARY KEY,document_id uuid NOT NULL,owner_id uuid NOT NULL,pet_id uuid NOT NULL,
  storage_object_id uuid NOT NULL UNIQUE,sha256 char(64) NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),
  byte_length bigint NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),capture_operation_id uuid NOT NULL UNIQUE,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),format_version integer NOT NULL DEFAULT 1 CHECK(format_version=1),
  capture_kind text NOT NULL CHECK(capture_kind IN('UPLOAD_BYTES','OBSERVED_EXISTING_AT_CAPTURE')),
  capture_coherence text NOT NULL CHECK(capture_coherence IN('UPLOAD_BUFFER','OBSERVED_SEQUENCE_ONLY')),
  observation_started_at timestamptz NOT NULL,observation_ended_at timestamptz NOT NULL CHECK(observation_ended_at>=observation_started_at),
  CHECK((capture_kind='UPLOAD_BYTES' AND capture_coherence='UPLOAD_BUFFER') OR (capture_kind='OBSERVED_EXISTING_AT_CAPTURE' AND capture_coherence='OBSERVED_SEQUENCE_ONLY')),
  FOREIGN KEY(document_id,owner_id,pet_id) REFERENCES pet_schema.pet_documents(id,owner_id,pet_id),
  UNIQUE(version_id,document_id,owner_id,pet_id,sha256,byte_length)
 );
 CREATE TABLE pet_schema.document_byte_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL REFERENCES pet_schema.document_byte_versions(version_id),
  event_type text NOT NULL CHECK(event_type IN('VERIFIED_CAPTURE','VERIFIED_USE','UNAVAILABLE','CORRUPT','REPLACED','RETIRED')),
  actor_id uuid NOT NULL REFERENCES identity_schema.users(id),operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),error_code text CHECK(error_code IN('SOURCE_UNAVAILABLE','SOURCE_CHANGED','INTEGRITY_FAILED')),
  UNIQUE(id,version_id)
 );
 CREATE TABLE pet_schema.ocr_job_byte_sources(
  job_id uuid PRIMARY KEY,document_id uuid NOT NULL,owner_id uuid NOT NULL,pet_id uuid NOT NULL,
  version_id uuid NOT NULL,sha256 char(64) NOT NULL,byte_length bigint NOT NULL,
  protocol_version integer NOT NULL DEFAULT 1 CHECK(protocol_version=1),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(job_id,document_id,owner_id,pet_id) REFERENCES pet_schema.ocr_jobs(id,document_id,owner_id,pet_id),
  FOREIGN KEY(version_id,document_id,owner_id,pet_id,sha256,byte_length) REFERENCES pet_schema.document_byte_versions(version_id,document_id,owner_id,pet_id,sha256,byte_length),
  UNIQUE(job_id,version_id,sha256,byte_length)
 );
 CREATE TABLE pet_schema.ocr_attempt_byte_receipts(
  attempt_id uuid PRIMARY KEY,job_id uuid NOT NULL,version_id uuid NOT NULL,sha256 char(64) NOT NULL,byte_length bigint NOT NULL,
  invocation_id uuid NOT NULL UNIQUE,verification_event_id uuid NOT NULL,
  input_evidence_class text NOT NULL CHECK(input_evidence_class IN('ACTUAL_BYTE_INPUT','SIMULATED_METADATA_ONLY')),
  full_consumption boolean NOT NULL,consumed_length bigint NOT NULL,consumed_sha256 char(64),adapter_identity text NOT NULL,adapter_version text,
  started_at timestamptz NOT NULL,finished_at timestamptz NOT NULL CHECK(finished_at>=started_at),
  CHECK(input_evidence_class<>'ACTUAL_BYTE_INPUT' OR (full_consumption AND consumed_length=byte_length AND consumed_sha256 IS NOT NULL AND consumed_sha256~'^[0-9a-f]{64}$' AND consumed_sha256=sha256)),
  FOREIGN KEY(attempt_id,job_id) REFERENCES pet_schema.ocr_attempts(id,job_id),
  FOREIGN KEY(job_id,version_id,sha256,byte_length) REFERENCES pet_schema.ocr_job_byte_sources(job_id,version_id,sha256,byte_length),
  FOREIGN KEY(verification_event_id,version_id) REFERENCES pet_schema.document_byte_events(id,version_id),
  UNIQUE(attempt_id,job_id,version_id,sha256,byte_length)
 );
 ALTER TABLE pet_schema.ocr_results ADD CONSTRAINT ocr_result_attempt_context UNIQUE(id,job_id,attempt_id);
 CREATE TABLE pet_schema.ocr_result_byte_bindings(
  result_id uuid PRIMARY KEY,job_id uuid NOT NULL,attempt_id uuid NOT NULL UNIQUE,version_id uuid NOT NULL,
  sha256 char(64) NOT NULL,byte_length bigint NOT NULL,source_binding_identity char(64) NOT NULL CHECK(source_binding_identity~'^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(result_id,job_id,attempt_id) REFERENCES pet_schema.ocr_results(id,job_id,attempt_id),
  FOREIGN KEY(attempt_id,job_id,version_id,sha256,byte_length) REFERENCES pet_schema.ocr_attempt_byte_receipts(attempt_id,job_id,version_id,sha256,byte_length)
 );
 CREATE FUNCTION pet_schema.byte_version_context() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE doc pet_schema.pet_documents%ROWTYPE;
 BEGIN
  PERFORM id FROM pet_schema.pets WHERE id=NEW.pet_id AND owner_id=NEW.owner_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Byte source unavailable'; END IF;
  SELECT * INTO doc FROM pet_schema.pet_documents WHERE id=NEW.document_id AND owner_id=NEW.owner_id AND pet_id=NEW.pet_id AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Byte context unavailable'; END IF;
  IF NEW.capture_kind='UPLOAD_BYTES' AND (doc.storage_key IS DISTINCT FROM (NEW.storage_object_id::text||'.blob') OR doc.file_size_bytes IS DISTINCT FROM NEW.byte_length) THEN RAISE EXCEPTION 'Byte publication mismatch'; END IF;
  NEW.captured_at:=clock_timestamp();RETURN NEW;
 END $$;
 CREATE TRIGGER byte_version_context BEFORE INSERT ON pet_schema.document_byte_versions FOR EACH ROW EXECUTE FUNCTION pet_schema.byte_version_context();
 CREATE FUNCTION pet_schema.byte_source_context() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE job pet_schema.ocr_jobs%ROWTYPE;v pet_schema.document_byte_versions%ROWTYPE;
 BEGIN
  SELECT * INTO job FROM pet_schema.ocr_jobs WHERE id=NEW.job_id FOR UPDATE;
  IF NOT FOUND OR job.state<>'QUEUED' OR job.attempt_count<>0 OR job.byte_source_creation_xid IS DISTINCT FROM pg_current_xact_id() OR EXISTS(SELECT 1 FROM pet_schema.ocr_attempts WHERE job_id=job.id) THEN RAISE EXCEPTION 'Existing OCR job cannot be rebound'; END IF;
  PERFORM id FROM pet_schema.pets WHERE id=NEW.pet_id AND owner_id=NEW.owner_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Byte owner unavailable'; END IF;
  PERFORM id FROM pet_schema.pet_documents WHERE id=NEW.document_id AND owner_id=NEW.owner_id AND pet_id=NEW.pet_id AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Byte document unavailable'; END IF;
  SELECT * INTO v FROM pet_schema.document_byte_versions WHERE version_id=NEW.version_id FOR UPDATE;
  IF NOT FOUND OR v.capture_coherence<>'UPLOAD_BUFFER' OR NOT EXISTS(SELECT 1 FROM pet_schema.document_byte_events WHERE version_id=v.version_id AND event_type='VERIFIED_CAPTURE') OR EXISTS(SELECT 1 FROM pet_schema.document_byte_events WHERE version_id=v.version_id AND event_type IN('UNAVAILABLE','CORRUPT','REPLACED','RETIRED')) THEN RAISE EXCEPTION 'Byte version unavailable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pet_schema.pet_documents WHERE id=NEW.document_id AND storage_key=(v.storage_object_id::text||'.blob') AND file_size_bytes=v.byte_length) THEN RAISE EXCEPTION 'Byte source changed'; END IF;
  NEW.created_at:=clock_timestamp();RETURN NEW;
 END $$;
 CREATE TRIGGER byte_source_context BEFORE INSERT ON pet_schema.ocr_job_byte_sources FOR EACH ROW EXECUTE FUNCTION pet_schema.byte_source_context();
 CREATE FUNCTION pet_schema.byte_event_context() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE v pet_schema.document_byte_versions%ROWTYPE;
 BEGIN
  -- Version-only lock: never acquire upstream job/Pet/Document after this lock.
  SELECT * INTO v FROM pet_schema.document_byte_versions WHERE version_id=NEW.version_id FOR UPDATE;
  IF v.owner_id IS DISTINCT FROM NEW.actor_id THEN RAISE EXCEPTION 'Byte event actor mismatch'; END IF;
  IF NEW.event_type IN('VERIFIED_CAPTURE','VERIFIED_USE') AND EXISTS(SELECT 1 FROM pet_schema.document_byte_events WHERE version_id=v.version_id AND event_type IN('UNAVAILABLE','CORRUPT','REPLACED','RETIRED')) THEN RAISE EXCEPTION 'Byte version retired'; END IF;
  NEW.created_at:=clock_timestamp();RETURN NEW;
 END $$;
 CREATE TRIGGER byte_event_context BEFORE INSERT ON pet_schema.document_byte_events FOR EACH ROW EXECUTE FUNCTION pet_schema.byte_event_context();
 CREATE FUNCTION pet_schema.byte_provenance_retained() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Byte provenance is append-only'; END $$;
 CREATE FUNCTION pet_schema.ocr_attestation_disabled() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'OCR input attestation is not enabled'; END $$;
 CREATE TRIGGER byte_receipt_disabled BEFORE INSERT ON pet_schema.ocr_attempt_byte_receipts FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_attestation_disabled();
 CREATE TRIGGER byte_result_binding_disabled BEFORE INSERT ON pet_schema.ocr_result_byte_bindings FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_attestation_disabled();
 CREATE FUNCTION pet_schema.ocr_bound_claim_denied() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF NEW.state='RUNNING' AND EXISTS(SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=NEW.id) THEN RAISE EXCEPTION 'Bound OCR claim requires future attested worker'; END IF;
  RETURN NEW;
 END $$;
 CREATE TRIGGER ocr_bound_claim_denied BEFORE UPDATE ON pet_schema.ocr_jobs FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_claim_denied();
 CREATE FUNCTION pet_schema.ocr_bound_success_guard() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE jid uuid;
 BEGIN
  IF TG_TABLE_NAME='ocr_jobs' THEN jid:=NEW.id;ELSE jid:=NEW.job_id;END IF;
  IF EXISTS(SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=jid) AND EXISTS(SELECT 1 FROM pet_schema.ocr_jobs WHERE id=jid AND state='SUCCEEDED') THEN
   -- All attestations are disabled in this checkpoint; even old binaries must fail closed.
   RAISE EXCEPTION 'Bound OCR success requires accepted execution receipt';
  END IF;RETURN NULL;
 END $$;
 CREATE CONSTRAINT TRIGGER ocr_bound_success_guard AFTER INSERT OR UPDATE ON pet_schema.ocr_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_success_guard();
 CREATE CONSTRAINT TRIGGER ocr_bound_result_guard AFTER INSERT ON pet_schema.ocr_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_success_guard();
 CREATE CONSTRAINT TRIGGER ocr_bound_source_guard AFTER INSERT ON pet_schema.ocr_job_byte_sources DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_success_guard();
 DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['document_byte_versions','document_byte_events','ocr_job_byte_sources','ocr_attempt_byte_receipts','ocr_result_byte_bindings'] LOOP
  EXECUTE format('CREATE TRIGGER byte_no_mutation BEFORE UPDATE OR DELETE ON pet_schema.%I FOR EACH ROW EXECUTE FUNCTION pet_schema.byte_provenance_retained()',t);
  EXECUTE format('CREATE TRIGGER byte_no_truncate BEFORE TRUNCATE ON pet_schema.%I FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.byte_provenance_retained()',t);
 END LOOP;END $$;
`);
exports.down=()=>{throw new Error('Byte provenance retained; disable ALL OCR claimers, destructive DOWN unsupported.');};
