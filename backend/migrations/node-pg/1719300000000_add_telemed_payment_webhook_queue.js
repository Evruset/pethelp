/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_provider_webhook_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_event_id text NOT NULL UNIQUE,
      payment_intent_id uuid REFERENCES telemed_schema.telemed_payment_intents(id),
      event_type text NOT NULL,
      signature_valid boolean NOT NULL,
      payload_sha256 text NOT NULL,
      raw_payload text NOT NULL,
      processing_status text NOT NULL CHECK (processing_status IN ('PROCESSED', 'DUPLICATE', 'FENCED')),
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_provider_webhook_events_payment_idx
      ON telemed_schema.telemed_provider_webhook_events (payment_intent_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_payment_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_intent_id uuid NOT NULL REFERENCES telemed_schema.telemed_payment_intents(id),
      event_type text NOT NULL CHECK (event_type IN (
        'PROVIDER_WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'QUEUE_ENTERED',
        'DUPLICATE_WEBHOOK_OBSERVED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'REFUND_PENDING',
        'REFUND_DISPATCHED'
      )),
      provider_event_id text,
      idempotency_key text NOT NULL UNIQUE,
      payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_payment_events_intent_created_idx
      ON telemed_schema.telemed_payment_events (payment_intent_id, created_at DESC);

    CREATE OR REPLACE FUNCTION telemed_schema.prevent_telemed_payment_event_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'telemed payment events are immutable';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS telemed_payment_events_immutable ON telemed_schema.telemed_payment_events;
    CREATE TRIGGER telemed_payment_events_immutable
      BEFORE UPDATE OR DELETE ON telemed_schema.telemed_payment_events
      FOR EACH ROW EXECUTE FUNCTION telemed_schema.prevent_telemed_payment_event_mutation();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS telemed_payment_events_immutable ON telemed_schema.telemed_payment_events;
    DROP FUNCTION IF EXISTS telemed_schema.prevent_telemed_payment_event_mutation();
    DROP TABLE IF EXISTS telemed_schema.telemed_payment_events;
    DROP TABLE IF EXISTS telemed_schema.telemed_provider_webhook_events;
  `);
};
