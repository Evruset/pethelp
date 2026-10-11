/* Append-only OCR foundation. No legacy values are rewritten or promoted. */
exports.up = (pgm) => pgm.sql(`
  CREATE VIEW pet_schema.ocr_legacy_unverified AS
    SELECT owner_id, id AS pet_id, NULL::uuid AS document_id,
      'PET_HISTORY'::text AS source_kind, 'LEGACY_UNVERIFIED'::text AS authority, medical_history_ocr AS raw_result
    FROM pet_schema.pets WHERE medical_history_ocr IS NOT NULL
    UNION ALL
    SELECT owner_id, pet_id, id, 'DOCUMENT', 'LEGACY_UNVERIFIED', ocr_result
    FROM pet_schema.pet_documents WHERE ocr_result IS NOT NULL;

  CREATE TABLE pet_schema.ocr_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL UNIQUE,
    owner_id uuid NOT NULL, pet_id uuid NOT NULL,
    source_identity char(64) NOT NULL CHECK(source_identity ~ '^[0-9a-f]{64}$'),
    source_snapshot jsonb NOT NULL CHECK(octet_length(source_snapshot::text) <= 8192),
    state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN('QUEUED','RUNNING','SUCCEEDED','FAILED')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
    claim_token uuid, lease_until timestamptz,
    available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    error_code text CHECK(error_code IN('PROVIDER_FAILED','INVALID_RESULT','LEASE_EXPIRED','SOURCE_UNAVAILABLE','SOURCE_CHANGED')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY(document_id,owner_id,pet_id) REFERENCES pet_schema.pet_documents(id,owner_id,pet_id),
    UNIQUE(id,document_id,owner_id,pet_id),
    CHECK((state='RUNNING') = (claim_token IS NOT NULL AND lease_until IS NOT NULL)),
    CHECK(state<>'RUNNING' OR attempt_count>0)
  );
  CREATE INDEX ocr_jobs_queue_idx ON pet_schema.ocr_jobs(available_at,created_at,id) WHERE state IN('QUEUED','RUNNING');
  CREATE TABLE pet_schema.ocr_attempts (
    id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES pet_schema.ocr_jobs(id),
    attempt_number integer NOT NULL CHECK(attempt_number BETWEEN 1 AND 3),
    status text NOT NULL CHECK(status IN('RUNNING','SUCCEEDED','FAILED','ABANDONED')),
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz,
    error_code text CHECK(error_code IN('PROVIDER_FAILED','INVALID_RESULT','LEASE_EXPIRED','SOURCE_UNAVAILABLE','SOURCE_CHANGED')),
    provider_identity varchar(120), provider_version varchar(80),
    UNIQUE(job_id,attempt_number), UNIQUE(id,job_id),
    CHECK((status='RUNNING') = (finished_at IS NULL))
  );
  CREATE TABLE pet_schema.ocr_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE,
    attempt_id uuid NOT NULL, document_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
    source_identity char(64) NOT NULL, result_identity char(64) NOT NULL CHECK(result_identity ~ '^[0-9a-f]{64}$'),
    extraction jsonb NOT NULL CHECK(jsonb_typeof(extraction)='object' AND octet_length(extraction::text)<=65536),
    extracted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    authority text NOT NULL DEFAULT 'UNCONFIRMED' CHECK(authority='UNCONFIRMED'),
    FOREIGN KEY(job_id,document_id,owner_id,pet_id) REFERENCES pet_schema.ocr_jobs(id,document_id,owner_id,pet_id),
    FOREIGN KEY(attempt_id,job_id) REFERENCES pet_schema.ocr_attempts(id,job_id),
    UNIQUE(id,job_id)
  );
  CREATE TABLE pet_schema.ocr_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), result_id uuid NOT NULL UNIQUE,
    job_id uuid NOT NULL, schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
    kind text NOT NULL DEFAULT 'EXTRACTED_TEXT' CHECK(kind='EXTRACTED_TEXT'),
    extracted_text text NOT NULL CHECK(octet_length(extracted_text)<=32768),
    review_state text NOT NULL DEFAULT 'PENDING_OWNER_REVIEW' CHECK(review_state='PENDING_OWNER_REVIEW'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY(result_id,job_id) REFERENCES pet_schema.ocr_results(id,job_id)
  );
  CREATE FUNCTION pet_schema.guard_ocr_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP='DELETE' OR TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'OCR provenance is retained'; END IF;
    IF TG_TABLE_NAME='ocr_jobs' THEN
      IF (NEW.id,NEW.document_id,NEW.owner_id,NEW.pet_id,NEW.source_identity,NEW.source_snapshot,NEW.created_at)
        IS DISTINCT FROM (OLD.id,OLD.document_id,OLD.owner_id,OLD.pet_id,OLD.source_identity,OLD.source_snapshot,OLD.created_at)
        THEN RAISE EXCEPTION 'OCR source is immutable'; END IF;
      IF OLD.state='SUCCEEDED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'OCR success is immutable'; END IF;
    ELSIF TG_TABLE_NAME='ocr_attempts' THEN
      IF OLD.status<>'RUNNING' OR NEW.status='RUNNING' OR
        (NEW.id,NEW.job_id,NEW.attempt_number,NEW.started_at) IS DISTINCT FROM (OLD.id,OLD.job_id,OLD.attempt_number,OLD.started_at)
        THEN RAISE EXCEPTION 'OCR completed attempt is immutable'; END IF;
    ELSE RAISE EXCEPTION 'OCR extraction is immutable'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER ocr_jobs_immutable BEFORE UPDATE OR DELETE ON pet_schema.ocr_jobs FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_attempts_immutable BEFORE UPDATE OR DELETE ON pet_schema.ocr_attempts FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_results_immutable BEFORE UPDATE OR DELETE ON pet_schema.ocr_results FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_candidates_immutable BEFORE UPDATE OR DELETE ON pet_schema.ocr_candidates FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_jobs_no_truncate BEFORE TRUNCATE ON pet_schema.ocr_jobs FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_attempts_no_truncate BEFORE TRUNCATE ON pet_schema.ocr_attempts FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_results_no_truncate BEFORE TRUNCATE ON pet_schema.ocr_results FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
  CREATE TRIGGER ocr_candidates_no_truncate BEFORE TRUNCATE ON pet_schema.ocr_candidates FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.guard_ocr_immutable();
`);
exports.down = () => { throw new Error('OCR provenance retained: disable the worker; destructive DOWN is unsupported.'); };
