/* Owner text decisions only. No validated import or medical promotion. */
exports.up = (pgm) => pgm.sql(`
  ALTER TABLE pet_schema.ocr_candidates ADD CONSTRAINT ocr_candidate_result_context UNIQUE(id,job_id,result_id);
  CREATE TABLE pet_schema.ocr_review_revisions (
    candidate_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
    expected_revision integer NOT NULL CHECK(expected_revision>=0 AND revision=expected_revision+1),
    job_id uuid NOT NULL, result_id uuid NOT NULL, document_id uuid NOT NULL, owner_id uuid NOT NULL, pet_id uuid NOT NULL,
    actor_id uuid NOT NULL REFERENCES identity_schema.users(id),
    action text NOT NULL CHECK(action IN('START','CORRECT','CONFIRM','REJECT')),
    review_state text NOT NULL CHECK(review_state IN('IN_REVIEW','CONFIRMED','REJECTED')),
    text_version integer NOT NULL CHECK(text_version>=0 AND text_version<=revision),
    corrected_text text NOT NULL CHECK(octet_length(corrected_text) BETWEEN 0 AND 32768),
    original_text_identity char(64) NOT NULL CHECK(original_text_identity ~ '^[0-9a-f]{64}$'),
    text_identity char(64) NOT NULL CHECK(text_identity ~ '^[0-9a-f]{64}$'),
    source_identity char(64) NOT NULL, result_identity char(64) NOT NULL,
    idempotency_key uuid NOT NULL, payload_identity char(64) NOT NULL CHECK(payload_identity ~ '^[0-9a-f]{64}$'),
    authority text NOT NULL DEFAULT 'OWNER_DECISION_ONLY' CHECK(authority='OWNER_DECISION_ONLY'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(candidate_id,revision), UNIQUE(owner_id,idempotency_key),
    FOREIGN KEY(candidate_id,job_id,result_id) REFERENCES pet_schema.ocr_candidates(id,job_id,result_id),
    FOREIGN KEY(job_id,document_id,owner_id,pet_id) REFERENCES pet_schema.ocr_jobs(id,document_id,owner_id,pet_id)
  );
  CREATE FUNCTION pet_schema.enforce_ocr_review_revision() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE
    candidate pet_schema.ocr_candidates%ROWTYPE;
    job pet_schema.ocr_jobs%ROWTYPE;
    result pet_schema.ocr_results%ROWTYPE;
    previous pet_schema.ocr_review_revisions%ROWTYPE;
    current_revision integer; current_text text; current_text_version integer; current_state text;
  BEGIN
    SELECT * INTO job FROM pet_schema.ocr_jobs WHERE id=NEW.job_id FOR SHARE;
    IF NOT FOUND OR job.state<>'SUCCEEDED' THEN RAISE EXCEPTION 'OCR review unavailable' USING ERRCODE='40001'; END IF;
    PERFORM id FROM pet_schema.pets WHERE id=job.pet_id AND owner_id=job.owner_id AND archived_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OCR review unavailable' USING ERRCODE='40001'; END IF;
    PERFORM id FROM pet_schema.pet_documents WHERE id=job.document_id AND owner_id=job.owner_id AND pet_id=job.pet_id AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OCR review unavailable' USING ERRCODE='40001'; END IF;
    SELECT * INTO candidate FROM pet_schema.ocr_candidates WHERE id=NEW.candidate_id FOR UPDATE;
    SELECT * INTO result FROM pet_schema.ocr_results WHERE id=candidate.result_id;
    IF candidate.id IS NULL OR result.id IS NULL OR
      (NEW.job_id,NEW.result_id,NEW.document_id,NEW.owner_id,NEW.pet_id,NEW.actor_id,NEW.source_identity,NEW.result_identity)
      IS DISTINCT FROM (candidate.job_id,candidate.result_id,job.document_id,job.owner_id,job.pet_id,job.owner_id,result.source_identity,result.result_identity)
      THEN RAISE EXCEPTION 'OCR review context mismatch' USING ERRCODE='23514'; END IF;
    SELECT * INTO previous FROM pet_schema.ocr_review_revisions WHERE candidate_id=candidate.id ORDER BY revision DESC LIMIT 1;
    current_revision:=COALESCE(previous.revision,0);
    current_text:=COALESCE(previous.corrected_text,candidate.extracted_text);
    current_text_version:=COALESCE(previous.text_version,0);
    current_state:=COALESCE(previous.review_state,'PENDING_OWNER_REVIEW');
    IF NEW.expected_revision<>current_revision OR current_state IN('CONFIRMED','REJECTED') OR
      (NEW.action='START' AND current_state<>'PENDING_OWNER_REVIEW')
      THEN RAISE EXCEPTION 'OCR review revision conflict' USING ERRCODE='40001'; END IF;
    IF NEW.original_text_identity<>encode(digest(candidate.extracted_text,'sha256'),'hex') OR
      NEW.text_identity<>encode(digest(NEW.corrected_text,'sha256'),'hex') OR (NEW.action='CORRECT' AND btrim(NEW.corrected_text)='') OR
      (NEW.action<>'CORRECT' AND NEW.corrected_text<>current_text) OR
      NEW.text_version<>(CASE WHEN NEW.action='CORRECT' THEN NEW.revision ELSE current_text_version END) OR
      NEW.review_state<>(CASE WHEN NEW.action IN('START','CORRECT') THEN 'IN_REVIEW' WHEN NEW.action='CONFIRM' THEN 'CONFIRMED' ELSE 'REJECTED' END)
      THEN RAISE EXCEPTION 'OCR review content mismatch' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER ocr_review_revision_integrity BEFORE INSERT ON pet_schema.ocr_review_revisions FOR EACH ROW EXECUTE FUNCTION pet_schema.enforce_ocr_review_revision();
  CREATE FUNCTION pet_schema.ocr_review_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'OCR decisions are append-only'; END $$;
  CREATE TRIGGER ocr_review_no_mutation BEFORE UPDATE OR DELETE ON pet_schema.ocr_review_revisions FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_review_append_only();
  CREATE TRIGGER ocr_review_no_truncate BEFORE TRUNCATE ON pet_schema.ocr_review_revisions FOR EACH STATEMENT EXECUTE FUNCTION pet_schema.ocr_review_append_only();
`);
exports.down = () => { throw new Error('Owner OCR review history retained; destructive DOWN is unsupported.'); };
