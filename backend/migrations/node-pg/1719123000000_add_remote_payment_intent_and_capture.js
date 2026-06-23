/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;

    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'VOIDED',
        'FAILED'
      ));

    ALTER TABLE payment_schema.payment_intents
      ADD COLUMN IF NOT EXISTS checkout_url text,
      ADD COLUMN IF NOT EXISTS provider_last_error text,
      ADD COLUMN IF NOT EXISTS capture_requested_at timestamptz,
      ADD COLUMN IF NOT EXISTS capture_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS capture_confirmed_at timestamptz;

    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;

    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (
        'INTENT_CREATED',
        'PROVIDER_INTENT_CREATED',
        'PROVIDER_INTENT_FAILED',
        'WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'CAPTURE_REQUESTED',
        'CAPTURE_SENT',
        'CAPTURE_CONFIRMED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'VOID_CONFIRMED',
        'RECONCILIATION_OBSERVED'
      ));

    CREATE INDEX IF NOT EXISTS payment_intents_capture_reconcile_idx
      ON payment_schema.payment_intents (capture_sent_at, capture_confirmed_at)
      WHERE status = 'AUTHORIZED' AND capture_sent_at IS NOT NULL AND capture_confirmed_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS payment_schema.payment_intents_capture_reconcile_idx;

    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (
        'INTENT_CREATED',
        'WEBHOOK_RECEIVED',
        'AUTHORIZED',
        'VOID_REQUESTED',
        'VOID_SENT',
        'VOID_CONFIRMED',
        'RECONCILIATION_OBSERVED'
      ));

    ALTER TABLE payment_schema.payment_intents
      DROP COLUMN IF EXISTS capture_confirmed_at,
      DROP COLUMN IF EXISTS capture_sent_at,
      DROP COLUMN IF EXISTS capture_requested_at,
      DROP COLUMN IF EXISTS provider_last_error,
      DROP COLUMN IF EXISTS checkout_url;

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'VOIDED', 'FAILED'));
  `);
};
