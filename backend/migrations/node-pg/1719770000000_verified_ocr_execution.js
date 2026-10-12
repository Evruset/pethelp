/* Additive byte execution protocol; no historical migration or evidence rewrite. */
exports.up=pgm=>pgm.sql(`
 DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='vethelp_ocr_byte_executor') THEN CREATE ROLE vethelp_ocr_byte_executor NOLOGIN; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='vethelp_ocr_byte_executor' AND (rolcanlogin OR rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe OCR writer role'; END IF;
 END $$;
 GRANT USAGE ON SCHEMA pet_schema,identity_schema,audit_schema TO vethelp_ocr_byte_executor;
 GRANT SELECT ON pet_schema.pets,pet_schema.pet_documents,pet_schema.ocr_jobs,pet_schema.ocr_attempts,pet_schema.ocr_results,pet_schema.ocr_candidates,pet_schema.document_byte_versions,pet_schema.document_byte_events,pet_schema.ocr_job_byte_sources,pet_schema.ocr_attempt_byte_receipts,pet_schema.ocr_result_byte_bindings TO vethelp_ocr_byte_executor;
 GRANT UPDATE(id) ON pet_schema.pets,pet_schema.pet_documents TO vethelp_ocr_byte_executor;
 GRANT UPDATE(version_id) ON pet_schema.document_byte_versions TO vethelp_ocr_byte_executor; -- SELECT FOR SHARE/UPDATE requires UPDATE privilege; immutable triggers still apply.
 GRANT UPDATE ON pet_schema.ocr_jobs,pet_schema.ocr_attempts TO vethelp_ocr_byte_executor;
 GRANT INSERT ON pet_schema.ocr_attempts,pet_schema.ocr_results,pet_schema.ocr_candidates,pet_schema.document_byte_events,pet_schema.ocr_attempt_byte_receipts,pet_schema.ocr_result_byte_bindings,audit_schema.audit_log TO vethelp_ocr_byte_executor;
 REVOKE ALL ON pet_schema.ocr_attempt_byte_receipts,pet_schema.ocr_result_byte_bindings FROM PUBLIC;
 ALTER TABLE pet_schema.ocr_attempt_byte_receipts ADD COLUMN evidence_origin text CHECK(evidence_origin IN('TEST_CONSUMER','SIMULATED_PROVIDER')),ADD COLUMN extraction_identity char(64) CHECK(extraction_identity~'^[0-9a-f]{64}$'),ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
 CREATE FUNCTION pet_schema.require_ocr_byte_writer() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF current_user<>'vethelp_ocr_byte_executor' OR current_setting('app.ocr_byte_protocol',true) IS DISTINCT FROM 'VERIFIED_BYTES_V1' THEN RAISE EXCEPTION 'Trusted OCR byte writer required'; END IF;
 END $$;
 CREATE FUNCTION pet_schema.lock_ocr_byte_source(jid uuid) RETURNS pet_schema.ocr_job_byte_sources LANGUAGE plpgsql AS $$
 DECLARE j pet_schema.ocr_jobs%ROWTYPE;s pet_schema.ocr_job_byte_sources%ROWTYPE;v pet_schema.document_byte_versions%ROWTYPE;
 BEGIN
  SELECT * INTO j FROM pet_schema.ocr_jobs WHERE id=jid FOR UPDATE;
  SELECT * INTO s FROM pet_schema.ocr_job_byte_sources WHERE job_id=jid;
  IF s.job_id IS NULL THEN RAISE EXCEPTION 'Bound OCR source unavailable'; END IF;
  PERFORM id FROM pet_schema.pets WHERE id=j.pet_id AND owner_id=j.owner_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bound OCR owner unavailable'; END IF;
  PERFORM id FROM pet_schema.pet_documents WHERE id=j.document_id AND owner_id=j.owner_id AND pet_id=j.pet_id AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') AND doc_type=j.source_snapshot->>'documentType' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bound OCR document unavailable'; END IF;
  SELECT * INTO v FROM pet_schema.document_byte_versions WHERE version_id=s.version_id FOR UPDATE;
  IF v.capture_coherence<>'UPLOAD_BUFFER' OR EXISTS(SELECT 1 FROM pet_schema.document_byte_events WHERE version_id=s.version_id AND event_type IN('UNAVAILABLE','CORRUPT','REPLACED','RETIRED')) OR NOT EXISTS(SELECT 1 FROM pet_schema.pet_documents WHERE id=j.document_id AND storage_key=v.storage_object_id::text||'.blob' AND file_size_bytes=v.byte_length) THEN RAISE EXCEPTION 'Bound OCR source changed'; END IF;
  RETURN s;
 END $$;
 CREATE OR REPLACE FUNCTION pet_schema.ocr_bound_claim_denied() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.state='RUNNING' AND EXISTS(SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=NEW.id) THEN
   PERFORM pet_schema.require_ocr_byte_writer();PERFORM pet_schema.lock_ocr_byte_source(NEW.id);
  END IF;RETURN NEW;
 END $$;
 DROP TRIGGER byte_receipt_disabled ON pet_schema.ocr_attempt_byte_receipts;
 DROP TRIGGER byte_result_binding_disabled ON pet_schema.ocr_result_byte_bindings;
 CREATE FUNCTION pet_schema.guard_ocr_byte_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE j pet_schema.ocr_jobs%ROWTYPE;s pet_schema.ocr_job_byte_sources%ROWTYPE;a pet_schema.ocr_attempts%ROWTYPE;
 BEGIN
  PERFORM pet_schema.require_ocr_byte_writer();s:=pet_schema.lock_ocr_byte_source(NEW.job_id);
  SELECT * INTO j FROM pet_schema.ocr_jobs WHERE id=NEW.job_id;SELECT * INTO a FROM pet_schema.ocr_attempts WHERE id=NEW.attempt_id AND job_id=NEW.job_id FOR UPDATE;
  IF j.state<>'RUNNING' OR j.claim_token IS DISTINCT FROM NEW.attempt_id OR j.lease_until<=clock_timestamp() OR a.status IS DISTINCT FROM 'SUCCEEDED' OR (NEW.version_id,NEW.sha256,NEW.byte_length) IS DISTINCT FROM (s.version_id,s.sha256,s.byte_length) OR NEW.extraction_identity IS NULL THEN RAISE EXCEPTION 'OCR receipt context invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pet_schema.document_byte_events WHERE id=NEW.verification_event_id AND version_id=s.version_id AND event_type='VERIFIED_USE' AND actor_id=s.owner_id) THEN RAISE EXCEPTION 'OCR verification event invalid'; END IF;
  IF NEW.started_at<a.started_at OR NEW.finished_at<NEW.started_at OR NEW.finished_at>clock_timestamp()+interval '5 seconds' OR NEW.adapter_identity!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' OR length(NEW.adapter_version)>80 THEN RAISE EXCEPTION 'OCR receipt provenance invalid'; END IF;
  IF NEW.input_evidence_class='ACTUAL_BYTE_INPUT' THEN
   IF NEW.evidence_origin IS DISTINCT FROM 'TEST_CONSUMER' OR NEW.adapter_identity<>'TEST_BYTE_CONSUMER' THEN RAISE EXCEPTION 'Actual OCR adapter not accepted'; END IF;
  ELSIF NEW.evidence_origin IS DISTINCT FROM 'SIMULATED_PROVIDER' OR NEW.adapter_identity<>'SIMULATED_OCR' OR NEW.full_consumption OR NEW.consumed_length<>0 OR NEW.consumed_sha256 IS NOT NULL THEN RAISE EXCEPTION 'Simulation receipt invalid'; END IF;
  NEW.recorded_at:=clock_timestamp();RETURN NEW;
 END $$;
 CREATE TRIGGER guard_ocr_byte_receipt BEFORE INSERT ON pet_schema.ocr_attempt_byte_receipts FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_byte_receipt();
 CREATE FUNCTION pet_schema.guard_ocr_result_binding() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE r pet_schema.ocr_results%ROWTYPE;e pet_schema.ocr_attempt_byte_receipts%ROWTYPE;s pet_schema.ocr_job_byte_sources%ROWTYPE;
 BEGIN
  PERFORM pet_schema.require_ocr_byte_writer();s:=pet_schema.lock_ocr_byte_source(NEW.job_id);
  SELECT * INTO r FROM pet_schema.ocr_results WHERE id=NEW.result_id;
  SELECT * INTO e FROM pet_schema.ocr_attempt_byte_receipts WHERE attempt_id=NEW.attempt_id AND job_id=NEW.job_id;
  IF r.attempt_id IS DISTINCT FROM NEW.attempt_id OR r.job_id IS DISTINCT FROM NEW.job_id OR e.input_evidence_class IS DISTINCT FROM 'ACTUAL_BYTE_INPUT' OR NOT e.full_consumption OR e.extraction_identity IS DISTINCT FROM r.result_identity OR (NEW.version_id,NEW.sha256,NEW.byte_length) IS DISTINCT FROM (s.version_id,s.sha256,s.byte_length) OR NEW.source_binding_identity<>encode(digest(concat_ws(':',NEW.job_id::text,NEW.attempt_id::text,NEW.version_id::text,NEW.sha256::text,NEW.byte_length::text,r.result_identity::text,e.invocation_id::text),'sha256'),'hex') THEN RAISE EXCEPTION 'OCR result binding invalid'; END IF;
  NEW.created_at:=clock_timestamp();RETURN NEW;
 END $$;
 CREATE TRIGGER guard_ocr_result_binding BEFORE INSERT ON pet_schema.ocr_result_byte_bindings FOR EACH ROW EXECUTE FUNCTION pet_schema.guard_ocr_result_binding();
 CREATE OR REPLACE FUNCTION pet_schema.ocr_bound_success_guard() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE jid uuid;j pet_schema.ocr_jobs%ROWTYPE;r pet_schema.ocr_results%ROWTYPE;e pet_schema.ocr_attempt_byte_receipts%ROWTYPE;
 BEGIN
  IF TG_TABLE_NAME='ocr_jobs' THEN jid:=NEW.id;ELSE jid:=NEW.job_id;END IF;
  IF NOT EXISTS(SELECT 1 FROM pet_schema.ocr_job_byte_sources WHERE job_id=jid) THEN RETURN NULL;END IF;
  SELECT * INTO j FROM pet_schema.ocr_jobs WHERE id=jid FOR UPDATE;
  SELECT * INTO r FROM pet_schema.ocr_results WHERE job_id=jid;
  SELECT * INTO e FROM pet_schema.ocr_attempt_byte_receipts WHERE job_id=jid;
  IF j.state='SUCCEEDED' THEN
   PERFORM pet_schema.require_ocr_byte_writer();PERFORM pet_schema.lock_ocr_byte_source(jid);
   IF r.id IS NULL OR e.attempt_id IS DISTINCT FROM r.attempt_id OR e.extraction_identity IS DISTINCT FROM r.result_identity OR NOT EXISTS(SELECT 1 FROM pet_schema.ocr_attempts WHERE id=r.attempt_id AND job_id=jid AND status='SUCCEEDED') OR NOT EXISTS(SELECT 1 FROM pet_schema.ocr_candidates WHERE result_id=r.id AND job_id=jid) THEN RAISE EXCEPTION 'Bound OCR success requires exact receipt';END IF;
   IF e.input_evidence_class='ACTUAL_BYTE_INPUT' AND NOT EXISTS(SELECT 1 FROM pet_schema.ocr_result_byte_bindings WHERE result_id=r.id AND attempt_id=r.attempt_id AND job_id=jid) THEN RAISE EXCEPTION 'Actual OCR binding required';END IF;
   IF e.input_evidence_class='SIMULATED_METADATA_ONLY' AND EXISTS(SELECT 1 FROM pet_schema.ocr_result_byte_bindings WHERE job_id=jid) THEN RAISE EXCEPTION 'Simulation cannot bind bytes';END IF;
  ELSIF r.id IS NOT NULL OR e.attempt_id IS NOT NULL OR EXISTS(SELECT 1 FROM pet_schema.ocr_result_byte_bindings WHERE job_id=jid) THEN RAISE EXCEPTION 'Incomplete bound OCR completion';END IF;
  RETURN NULL;
 END $$;
 CREATE CONSTRAINT TRIGGER byte_receipt_success_guard AFTER INSERT ON pet_schema.ocr_attempt_byte_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_success_guard();
 CREATE CONSTRAINT TRIGGER byte_binding_success_guard AFTER INSERT ON pet_schema.ocr_result_byte_bindings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pet_schema.ocr_bound_success_guard();
 REVOKE ALL ON FUNCTION pet_schema.lock_ocr_byte_source(uuid) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION pet_schema.lock_ocr_byte_source(uuid) TO vethelp_ocr_byte_executor;
`);
exports.down=()=>{throw new Error('OCR execution provenance retained; stop ALL claimers. Destructive DOWN unsupported.');};
