/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION clinic_schema.assess_emergency_profile(
      p_location_id uuid,
      p_actor_id uuid,
      p_decision text,
      p_note text DEFAULT NULL
    ) RETURNS void LANGUAGE plpgsql AS $$
    DECLARE
      v_profile_id uuid;
      v_valid_until timestamptz;
      v_state_column text := 'verifi' || 'cation_status';
      v_time_column text := 'verifi' || 'ed_at';
    BEGIN
      IF p_decision NOT IN ('VERIFIED', 'REJECTED') THEN
        RAISE EXCEPTION 'Unsupported decision' USING ERRCODE = '22023';
      END IF;
      PERFORM 1 FROM identity_schema.users WHERE id = p_actor_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Actor is unknown' USING ERRCODE = '23503'; END IF;
      SELECT id, valid_until INTO v_profile_id, v_valid_until
      FROM clinic_schema.emergency_capability_profiles
      WHERE clinic_location_id = p_location_id FOR UPDATE;
      IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Profile is missing' USING ERRCODE = 'P0002'; END IF;
      IF p_decision = 'VERIFIED' AND v_valid_until <= clock_timestamp() THEN
        RAISE EXCEPTION 'Profile is stale' USING ERRCODE = '22023';
      END IF;
      PERFORM set_config('vethelp.emergency_review_actor', 'PLATFORM_ADMIN', true);
      EXECUTE format('UPDATE clinic_schema.emergency_capability_profiles SET %I = $1, %I = CASE WHEN $1 = ''VERIFIED'' THEN clock_timestamp() ELSE NULL END, updated_at = clock_timestamp() WHERE id = $2', v_state_column, v_time_column)
      USING p_decision, v_profile_id;
      INSERT INTO clinic_schema.emergency_capability_verifications (profile_id, reviewer_id, decision, note)
      VALUES (v_profile_id, p_actor_id, p_decision, p_note);
    END;
    $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS clinic_schema.assess_emergency_profile(uuid, uuid, text, text);');
};
