/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    COMMENT ON COLUMN telemed_schema.telemed_payment_intents.payment_attempt_no IS
      'Forward-only data contract after 171933: do not drop when a case has multiple payment attempts. See backend/docs/MIGRATIONS.md.';
    COMMENT ON INDEX telemed_schema.telemed_payment_intents_case_attempt_uq IS
      'Preserves telemed payment attempt identity per case; rollback is guarded by 171935.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM telemed_schema.telemed_payment_intents
        GROUP BY case_id
        HAVING COUNT(*) > 1 OR MAX(payment_attempt_no) > 1
      ) THEN
        RAISE EXCEPTION
          'Unsafe rollback: telemed payment attempts contain multiple attempts per case. Keep 171933 forward-only or restore from backup.';
      END IF;
    END $$;

    COMMENT ON INDEX telemed_schema.telemed_payment_intents_case_attempt_uq IS NULL;
    COMMENT ON COLUMN telemed_schema.telemed_payment_intents.payment_attempt_no IS NULL;
  `);
};
