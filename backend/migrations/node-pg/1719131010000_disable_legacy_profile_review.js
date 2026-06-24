/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION clinic_schema.assess_emergency_profile(
      p_location_id uuid, p_actor_id uuid, p_decision text, p_note text DEFAULT NULL
    ) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Legacy location review is disabled; use the clinic review workflow' USING ERRCODE = '0A000';
    END;
    $$;

    CREATE OR REPLACE FUNCTION clinic_schema.review_emergency_profile(
      p_location_id uuid, p_actor_id uuid, p_decision text, p_note text DEFAULT NULL
    ) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Legacy location review is disabled; use the clinic review workflow' USING ERRCODE = '0A000';
    END;
    $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS clinic_schema.review_emergency_profile(uuid, uuid, text, text);');
};
