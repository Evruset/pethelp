/* eslint-disable camelcase */
exports.shorthands = undefined;
exports.up = (pgm) => { pgm.sql(`
  ALTER TABLE clinical_schema.visit_result_amendments ADD COLUMN version integer;
  ALTER TABLE clinical_schema.visit_result_amendments DISABLE TRIGGER visit_result_amendments_immutability_trigger;
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY result_id ORDER BY created_at, id)::integer AS version
    FROM clinical_schema.visit_result_amendments
  )
  UPDATE clinical_schema.visit_result_amendments amendment SET version=ranked.version FROM ranked WHERE ranked.id=amendment.id;
  ALTER TABLE clinical_schema.visit_result_amendments ENABLE TRIGGER visit_result_amendments_immutability_trigger;
  ALTER TABLE clinical_schema.visit_result_amendments ALTER COLUMN version SET NOT NULL;
  ALTER TABLE clinical_schema.visit_result_amendments ADD CONSTRAINT visit_result_amendments_version_check CHECK(version>0);
  ALTER TABLE clinical_schema.visit_result_amendments ADD CONSTRAINT visit_result_amendments_result_version_key UNIQUE(result_id,version);
  CREATE FUNCTION clinical_schema.assign_visit_result_amendment_version() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.version IS NULL THEN
      PERFORM 1 FROM clinical_schema.visit_results WHERE id=NEW.result_id FOR UPDATE;
      SELECT COALESCE(max(version),0)+1 INTO NEW.version FROM clinical_schema.visit_result_amendments WHERE result_id=NEW.result_id;
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER visit_result_amendments_assign_version BEFORE INSERT ON clinical_schema.visit_result_amendments
    FOR EACH ROW EXECUTE FUNCTION clinical_schema.assign_visit_result_amendment_version();
`); };
exports.down = (pgm) => { pgm.sql(`
  DO $$ BEGIN IF EXISTS(SELECT 1 FROM clinical_schema.visit_result_amendments) THEN RAISE EXCEPTION 'WAVE3_AMENDMENT_VERSION_ROLLBACK_APPROVAL_REQUIRED'; END IF; END $$;
  DROP TRIGGER visit_result_amendments_assign_version ON clinical_schema.visit_result_amendments;
  DROP FUNCTION clinical_schema.assign_visit_result_amendment_version();
  ALTER TABLE clinical_schema.visit_result_amendments DROP CONSTRAINT visit_result_amendments_result_version_key;
  ALTER TABLE clinical_schema.visit_result_amendments DROP CONSTRAINT visit_result_amendments_version_check;
  ALTER TABLE clinical_schema.visit_result_amendments DROP COLUMN version;
`); };
