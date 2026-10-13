/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinical_schema.visit_results ADD COLUMN publish_idempotency_key uuid;
    CREATE UNIQUE INDEX visit_results_publish_idempotency_key
      ON clinical_schema.visit_results (publish_idempotency_key)
      WHERE publish_idempotency_key IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM clinical_schema.visit_results WHERE status='PUBLISHED') THEN
        RAISE EXCEPTION 'WAVE3_PUBLISH_IDEMPOTENCY_ROLLBACK_APPROVAL_REQUIRED';
      END IF;
    END $$;
    DROP INDEX clinical_schema.visit_results_publish_idempotency_key;
    ALTER TABLE clinical_schema.visit_results DROP COLUMN publish_idempotency_key;
  `);
};
