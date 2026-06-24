/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION payment_schema.enforce_payment_price_snapshot()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE v_amount numeric(12, 2); v_currency char(3);
    BEGIN
      SELECT amount, currency INTO v_amount, v_currency
      FROM booking_schema.hold_price_snapshots
      WHERE hold_id = NEW.hold_id;
      IF v_amount IS NULL OR v_currency IS NULL THEN
        RAISE EXCEPTION 'Hold price snapshot is required before payment intent creation' USING ERRCODE = 'P0001';
      END IF;
      NEW.amount := v_amount;
      NEW.currency := v_currency;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS payment_intent_enforce_price_snapshot ON payment_schema.payment_intents;
    CREATE TRIGGER payment_intent_enforce_price_snapshot
      BEFORE INSERT ON payment_schema.payment_intents
      FOR EACH ROW EXECUTE FUNCTION payment_schema.enforce_payment_price_snapshot();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS payment_intent_enforce_price_snapshot ON payment_schema.payment_intents;
    DROP FUNCTION IF EXISTS payment_schema.enforce_payment_price_snapshot();
  `);
};
