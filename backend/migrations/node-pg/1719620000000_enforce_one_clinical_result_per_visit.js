/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM clinical_schema.visit_results
        GROUP BY visit_id
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'W7B_RESULT_CARDINALITY_DATA_REMEDIATION_REQUIRED'
          USING ERRCODE = '23514';
      END IF;
    END $$;

    ALTER TABLE clinical_schema.visit_results
      ADD CONSTRAINT visit_results_visit_key UNIQUE (visit_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinical_schema.visit_results
      DROP CONSTRAINT visit_results_visit_key;
  `);
};
