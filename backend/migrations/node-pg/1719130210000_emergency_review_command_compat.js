/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION clinic_schema.review_emergency_profile(
      p_location_id uuid,
      p_actor_id uuid,
      p_decision text,
      p_note text DEFAULT NULL
    ) RETURNS void LANGUAGE sql AS $$
      SELECT clinic_schema.assess_emergency_profile(p_location_id, p_actor_id, p_decision, p_note);
    $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS clinic_schema.review_emergency_profile(uuid, uuid, text, text);');
};
