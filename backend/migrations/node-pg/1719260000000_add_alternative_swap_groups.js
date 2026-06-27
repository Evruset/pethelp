/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS booking_schema.alternative_swap_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      original_hold_id uuid NOT NULL REFERENCES booking_schema.booking_holds(id),
      original_slot_id uuid NOT NULL REFERENCES clinic_schema.appointment_slots(id),
      alternative_slot_id uuid NOT NULL REFERENCES clinic_schema.appointment_slots(id),
      owner_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,
      state text NOT NULL CHECK (state IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','REPLACED')),
      aggregate_version integer NOT NULL DEFAULT 1,
      correlation_id uuid,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS alternative_swap_groups_one_pending_hold_idx
      ON booking_schema.alternative_swap_groups (original_hold_id)
      WHERE state = 'PENDING';

    CREATE INDEX IF NOT EXISTS alternative_swap_groups_expirable_idx
      ON booking_schema.alternative_swap_groups (expires_at, id)
      WHERE state = 'PENDING';

    CREATE INDEX IF NOT EXISTS alternative_swap_groups_owner_idx
      ON booking_schema.alternative_swap_groups (owner_id, created_at DESC);

    INSERT INTO booking_schema.alternative_swap_groups (
      original_hold_id, original_slot_id, alternative_slot_id, owner_id,
      expires_at, state, aggregate_version, created_at, updated_at
    )
    SELECT h.id, h.slot_id, h.alternative_slot_id, h.owner_id,
           h.alternative_expires_at, 'PENDING', 1, h.updated_at, h.updated_at
    FROM booking_schema.booking_holds h
    WHERE h.state = 'ALTERNATIVE_PENDING'
      AND h.alternative_slot_id IS NOT NULL
      AND h.alternative_expires_at IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS booking_schema.alternative_swap_groups_owner_idx;
    DROP INDEX IF EXISTS booking_schema.alternative_swap_groups_expirable_idx;
    DROP INDEX IF EXISTS booking_schema.alternative_swap_groups_one_pending_hold_idx;
    DROP TABLE IF EXISTS booking_schema.alternative_swap_groups;
  `);
};
