exports.up = (pgm) => pgm.sql(`ALTER TABLE booking_schema.alternative_swap_groups ADD COLUMN target_slot_version integer CHECK (target_slot_version IS NULL OR target_slot_version > 0);`);
exports.down = () => { throw new Error('IRREVERSIBLE_RESCHEDULE_VERSION_FENCE'); };
