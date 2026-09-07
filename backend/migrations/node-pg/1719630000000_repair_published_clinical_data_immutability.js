/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION clinical_schema.protect_published_clinical_data()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME <> 'visit_results' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'PUBLISHED' THEN
          RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_RECORD' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
      END IF;

      IF TG_TABLE_NAME = 'visit_results' THEN
        IF OLD.status = 'PUBLISHED' AND NEW IS DISTINCT FROM OLD THEN
          RAISE EXCEPTION 'W7A_PUBLISHED_RESULT_IMMUTABLE' USING ERRCODE = '23514';
        END IF;
      ELSE
        RAISE EXCEPTION 'W7A_IMMUTABLE_CLINICAL_PROJECTION' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      RAISE EXCEPTION 'W7_R4_DOWN_REQUIRES_EXPLICIT_DATA_GOVERNANCE_APPROVAL';
    END $$;
  `);
};
