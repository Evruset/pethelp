/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_cases
      ADD COLUMN IF NOT EXISTS assigned_employee_id uuid,
      ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
      ADD COLUMN IF NOT EXISTS safety_escalation boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS recommendation_text text,
      ADD COLUMN IF NOT EXISTS follow_up_notes text;

    CREATE INDEX IF NOT EXISTS telemed_cases_assigned_employee_idx
      ON telemed_schema.telemed_cases (assigned_employee_id, state, updated_at DESC)
      WHERE assigned_employee_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_case_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id uuid NOT NULL REFERENCES telemed_schema.telemed_cases(id) ON DELETE CASCADE,
      actor_type text NOT NULL,
      actor_id uuid,
      event_type text NOT NULL CHECK (event_type IN (
        'ASSIGNED',
        'SESSION_STARTED',
        'DOCTOR_CONNECTED',
        'DOCTOR_TIMEOUT',
        'SAFETY_ESCALATED',
        'RECOMMENDATION_SAVED',
        'FOLLOW_UP_ROUTED'
      )),
      payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_case_events_case_created_idx
      ON telemed_schema.telemed_case_events (case_id, created_at DESC);

    CREATE OR REPLACE FUNCTION telemed_schema.prevent_telemed_case_event_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'telemed case events are immutable';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS telemed_case_events_immutable ON telemed_schema.telemed_case_events;
    CREATE TRIGGER telemed_case_events_immutable
      BEFORE UPDATE OR DELETE ON telemed_schema.telemed_case_events
      FOR EACH ROW EXECUTE FUNCTION telemed_schema.prevent_telemed_case_event_mutation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS telemed_case_events_immutable ON telemed_schema.telemed_case_events;
    DROP FUNCTION IF EXISTS telemed_schema.prevent_telemed_case_event_mutation();
    DROP TABLE IF EXISTS telemed_schema.telemed_case_events;
    DROP INDEX IF EXISTS telemed_schema.telemed_cases_assigned_employee_idx;
    ALTER TABLE telemed_schema.telemed_cases
      DROP COLUMN IF EXISTS follow_up_notes,
      DROP COLUMN IF EXISTS recommendation_text,
      DROP COLUMN IF EXISTS safety_escalation,
      DROP COLUMN IF EXISTS assigned_at,
      DROP COLUMN IF EXISTS assigned_employee_id;
  `);
};
