/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_route_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      triage_session_id uuid REFERENCES clinic_schema.emergency_triage_sessions(id) ON DELETE SET NULL,
      clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
      action text NOT NULL CHECK (action IN ('CALL_STARTED', 'ROUTE_OPENED', 'FOLLOW_UP_REQUESTED')),
      follow_up_due_at timestamptz,
      source text NOT NULL DEFAULT 'owner_mobile',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS emergency_route_actions_session_created_idx
      ON clinic_schema.emergency_route_actions (triage_session_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS emergency_route_actions_location_created_idx
      ON clinic_schema.emergency_route_actions (clinic_location_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS emergency_route_actions_follow_up_due_idx
      ON clinic_schema.emergency_route_actions (follow_up_due_at)
      WHERE action = 'FOLLOW_UP_REQUESTED' AND follow_up_due_at IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS clinic_schema.emergency_route_actions;
  `);
};
