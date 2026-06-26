/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.payment_intents
      ADD COLUMN IF NOT EXISTS payment_attempt_no integer,
      ADD COLUMN IF NOT EXISTS payment_fence_token uuid;

    WITH numbered AS (
      SELECT
        id,
        row_number() OVER (PARTITION BY hold_id ORDER BY created_at, id)::integer AS attempt_no
      FROM payment_schema.payment_intents
    )
    UPDATE payment_schema.payment_intents p
    SET payment_attempt_no = COALESCE(p.payment_attempt_no, numbered.attempt_no),
        payment_fence_token = COALESCE(p.payment_fence_token, gen_random_uuid())
    FROM numbered
    WHERE p.id = numbered.id
      AND (p.payment_attempt_no IS NULL OR p.payment_fence_token IS NULL);

    ALTER TABLE payment_schema.payment_intents
      ALTER COLUMN payment_attempt_no SET NOT NULL,
      ALTER COLUMN payment_fence_token SET NOT NULL;

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_payment_attempt_no_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_payment_attempt_no_check CHECK (payment_attempt_no > 0);

    CREATE OR REPLACE FUNCTION payment_schema.assign_payment_attempt_fence()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.payment_attempt_no IS NULL THEN
        SELECT COALESCE(MAX(payment_attempt_no), 0) + 1
        INTO NEW.payment_attempt_no
        FROM payment_schema.payment_intents
        WHERE hold_id = NEW.hold_id;
      END IF;
      IF NEW.payment_fence_token IS NULL THEN
        NEW.payment_fence_token := gen_random_uuid();
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS payment_intent_assign_attempt_fence ON payment_schema.payment_intents;
    CREATE TRIGGER payment_intent_assign_attempt_fence
      BEFORE INSERT ON payment_schema.payment_intents
      FOR EACH ROW EXECUTE FUNCTION payment_schema.assign_payment_attempt_fence();

    CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_hold_attempt_no_uq
      ON payment_schema.payment_intents (hold_id, payment_attempt_no);

    CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_fence_token_uq
      ON payment_schema.payment_intents (payment_fence_token);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS payment_schema.payment_intents_fence_token_uq;
    DROP INDEX IF EXISTS payment_schema.payment_intents_hold_attempt_no_uq;
    DROP TRIGGER IF EXISTS payment_intent_assign_attempt_fence ON payment_schema.payment_intents;
    DROP FUNCTION IF EXISTS payment_schema.assign_payment_attempt_fence();
    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_payment_attempt_no_check;
    ALTER TABLE payment_schema.payment_intents
      DROP COLUMN IF EXISTS payment_fence_token,
      DROP COLUMN IF EXISTS payment_attempt_no;
  `);
};
