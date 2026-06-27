/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE telemed_schema.telemed_payment_intents
      ADD COLUMN IF NOT EXISTS payment_attempt_no integer;

    UPDATE telemed_schema.telemed_payment_intents
    SET payment_attempt_no = 1
    WHERE payment_attempt_no IS NULL;

    ALTER TABLE telemed_schema.telemed_payment_intents
      ALTER COLUMN payment_attempt_no SET NOT NULL;

    DO $$
    DECLARE
      case_unique_constraint text;
    BEGIN
      SELECT constraint_name
      INTO case_unique_constraint
      FROM information_schema.table_constraints constraint_info
      JOIN information_schema.constraint_column_usage column_info
        USING (constraint_catalog, constraint_schema, constraint_name)
      WHERE constraint_info.table_schema = 'telemed_schema'
        AND constraint_info.table_name = 'telemed_payment_intents'
        AND constraint_info.constraint_type = 'UNIQUE'
        AND column_info.column_name = 'case_id'
      LIMIT 1;

      IF case_unique_constraint IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE telemed_schema.telemed_payment_intents DROP CONSTRAINT %I',
          case_unique_constraint
        );
      END IF;
    END $$;

    DROP INDEX IF EXISTS telemed_schema.telemed_payment_intents_case_id_key;

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_payment_intents_case_attempt_uq
      ON telemed_schema.telemed_payment_intents (case_id, payment_attempt_no);

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_payment_intents_one_active_case_uq
      ON telemed_schema.telemed_payment_intents (case_id)
      WHERE status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'VOID_REQUESTED',
        'REFUND_PENDING'
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS telemed_schema.telemed_payment_intents_one_active_case_uq;
    DROP INDEX IF EXISTS telemed_schema.telemed_payment_intents_case_attempt_uq;
    ALTER TABLE telemed_schema.telemed_payment_intents
      DROP COLUMN IF EXISTS payment_attempt_no;
  `);
};
