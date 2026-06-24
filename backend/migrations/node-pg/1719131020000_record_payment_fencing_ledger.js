/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION payment_schema.record_fenced_payment_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.status = 'VOIDED' AND OLD.status IS DISTINCT FROM 'VOIDED' THEN
        INSERT INTO payment_schema.ledger_entries (
          payment_intent_id, entry_type, amount, currency, correlation_id,
          idempotency_key, payload_json
        ) VALUES (
          NEW.id, 'FENCED', NEW.amount, NEW.currency, NEW.correlation_id,
          'payment-fenced:' || NEW.id::text,
          jsonb_build_object(
            'paymentIntentId', NEW.id,
            'reason', 'LATE_OR_INVALID_PAYMENT_AUTHORIZATION',
            'statusBeforeFence', OLD.status
          )
        ) ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS payment_intent_record_fenced_ledger ON payment_schema.payment_intents;
    CREATE TRIGGER payment_intent_record_fenced_ledger
      AFTER UPDATE OF status ON payment_schema.payment_intents
      FOR EACH ROW EXECUTE FUNCTION payment_schema.record_fenced_payment_ledger();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS payment_intent_record_fenced_ledger ON payment_schema.payment_intents;
    DROP FUNCTION IF EXISTS payment_schema.record_fenced_payment_ledger();
  `);
};
