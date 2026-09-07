/* eslint-disable */
exports.shorthands = undefined;

const strictPublicationInvariant = `
  (publication_state = 'PUBLISHED' AND state = 'OPEN' AND published_at IS NOT NULL
    AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
  OR (publication_state = 'DRAFT' AND published_at IS NULL
    AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
  OR (publication_state = 'UNPUBLISHED' AND published_at IS NULL
    AND unpublished_at IS NOT NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
  OR (publication_state = 'BLOCKED' AND published_at IS NULL
    AND unpublished_at IS NULL AND blocked_at IS NOT NULL AND source_stale_at IS NULL)
  OR (publication_state = 'STALE_SOURCE' AND published_at IS NULL
    AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NOT NULL)
  OR (source <> 'DOCTOR_SHIFT' AND publication_state = 'PUBLISHED' AND state = 'OPEN'
    AND published_at IS NULL AND unpublished_at IS NULL
    AND blocked_at IS NULL AND source_stale_at IS NULL)
`;

exports.up = (pgm) => {
  pgm.sql(`
    DO $$ DECLARE violating_rows jsonb; BEGIN
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'clinic_location_id', clinic_location_id,
        'source', source,
        'doctor_shift_id', doctor_shift_id,
        'generation_run_id', generation_run_id,
        'publication_state', publication_state,
        'state', state,
        'published_at', published_at,
        'unpublished_at', unpublished_at,
        'blocked_at', blocked_at,
        'source_stale_at', source_stale_at,
        'created_at', created_at
      ) ORDER BY id)
      INTO violating_rows
      FROM clinic_schema.appointment_slots
      WHERE NOT (${strictPublicationInvariant});
      IF violating_rows IS NOT NULL THEN
        RAISE EXCEPTION 'DOCTORSHIFT_CONSTRAINT_DATA_REMEDIATION_APPROVAL_REQUIRED: %', violating_rows;
      END IF;
    END $$;

    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT appointment_slots_publication_timestamps_check,
      ADD CONSTRAINT appointment_slots_publication_timestamps_check
      CHECK (${strictPublicationInvariant}) NOT VALID;
    ALTER TABLE clinic_schema.appointment_slots
      VALIDATE CONSTRAINT appointment_slots_publication_timestamps_check;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE clinic_schema.appointment_slots
      DROP CONSTRAINT appointment_slots_publication_timestamps_check,
      ADD CONSTRAINT appointment_slots_publication_timestamps_check CHECK (
        (publication_state = 'PUBLISHED' AND state = 'OPEN' AND published_at IS NOT NULL
          AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'DRAFT' AND published_at IS NULL
          AND unpublished_at IS NULL AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'UNPUBLISHED' AND unpublished_at IS NOT NULL
          AND blocked_at IS NULL AND source_stale_at IS NULL)
        OR (publication_state = 'BLOCKED' AND blocked_at IS NOT NULL AND source_stale_at IS NULL)
        OR (publication_state = 'STALE_SOURCE' AND source_stale_at IS NOT NULL AND blocked_at IS NULL)
        OR (source <> 'DOCTOR_SHIFT' AND publication_state = 'PUBLISHED')
      ) NOT VALID;
    ALTER TABLE clinic_schema.appointment_slots
      VALIDATE CONSTRAINT appointment_slots_publication_timestamps_check;
  `);
};
