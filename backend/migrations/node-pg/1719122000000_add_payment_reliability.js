/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.payment_intents
      ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'RUB',
      ADD COLUMN IF NOT EXISTS provider_payment_id text,
      ADD COLUMN IF NOT EXISTS void_requested_at timestamptz,
      ADD COLUMN IF NOT EXISTS void_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS void_confirmed_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;

    CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_provider_payment_id_uq
      ON payment_schema.payment_intents (provider_payment_id)
      WHERE provider_payment_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS payment_schema.ledger_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_intent_id uuid NOT NULL REFERENCES payment_schema.payment_intents(id),
      entry_type text NOT NULL CHECK (entry_type IN (
        'INTENT_CREATED',
        'WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'VOID_CONFIRMED',
        'RECONCILIATION_OBSERVED'
      )),
      amount numeric(12,2) NOT NULL CHECK (amount >= 0),
      currency char(3) NOT NULL,
      idempotency_key varchar(160) NOT NULL,
      provider_event_id text,
      payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT ledger_entries_idempotency_uq UNIQUE (idempotency_key)
    );

    CREATE INDEX IF NOT EXISTS ledger_entries_payment_intent_idx
      ON payment_schema.ledger_entries (payment_intent_id, created_at);

    CREATE TABLE IF NOT EXISTS payment_schema.provider_webhook_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_event_id varchar(160) NOT NULL UNIQUE,
      payment_intent_id uuid REFERENCES payment_schema.payment_intents(id),
      event_type varchar(80) NOT NULL,
      signature_valid boolean NOT NULL,
      payload_sha256 char(64) NOT NULL,
      raw_payload text NOT NULL,
      processing_status text NOT NULL CHECK (processing_status IN ('PROCESSED', 'FENCED')),
      received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      processed_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE OR REPLACE FUNCTION payment_schema.prevent_ledger_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'payment ledger entries are immutable';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS ledger_entries_immutable ON payment_schema.ledger_entries;
    CREATE TRIGGER ledger_entries_immutable
      BEFORE UPDATE OR DELETE ON payment_schema.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION payment_schema.prevent_ledger_mutation();

    CREATE INDEX IF NOT EXISTS payment_intents_void_reconcile_idx
      ON payment_schema.payment_intents (void_sent_at, void_confirmed_at)
      WHERE status = 'VOIDED' AND void_sent_at IS NOT NULL AND void_confirmed_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS ledger_entries_immutable ON payment_schema.ledger_entries;
    DROP FUNCTION IF EXISTS payment_schema.prevent_ledger_mutation();
    DROP TABLE IF EXISTS payment_schema.provider_webhook_events;
    DROP TABLE IF EXISTS payment_schema.ledger_entries;
    DROP INDEX IF EXISTS payment_schema.payment_intents_void_reconcile_idx;
    DROP INDEX IF EXISTS payment_schema.payment_intents_provider_payment_id_uq;
    ALTER TABLE payment_schema.payment_intents
      DROP COLUMN IF EXISTS last_reconciled_at,
      DROP COLUMN IF EXISTS void_confirmed_at,
      DROP COLUMN IF EXISTS void_sent_at,
      DROP COLUMN IF EXISTS void_requested_at,
      DROP COLUMN IF EXISTS provider_payment_id,
      DROP COLUMN IF EXISTS currency;
  `);
};
