/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.payment_intents
      ADD COLUMN IF NOT EXISTS refunded_amount numeric(18, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS refund_provider_id varchar(255);

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'VOID_REQUESTED',
        'VOIDED',
        'REFUND_SENT',
        'REFUNDED',
        'FAILED'
      ));

    ALTER TABLE payment_schema.ledger_entries
      ADD COLUMN IF NOT EXISTS correlation_id uuid;

    CREATE INDEX IF NOT EXISTS ledger_entries_correlation_idx
      ON payment_schema.ledger_entries (correlation_id, created_at DESC)
      WHERE correlation_id IS NOT NULL;

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
        'RECONCILIATION_OBSERVED',
        'SLA_BREACH_AUTOMATIC_VOID',
        'REFUND_REQUESTED',
        'REFUND_DISPATCHED',
        'REFUND_CONFIRMED'
      ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS payment_schema.ledger_entries_correlation_idx;

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
        'RECONCILIATION_OBSERVED',
        'SLA_BREACH_AUTOMATIC_VOID'
      ));
    ALTER TABLE payment_schema.ledger_entries
      DROP COLUMN IF EXISTS correlation_id;

    ALTER TABLE payment_schema.payment_intents
      DROP CONSTRAINT IF EXISTS payment_intents_status_check;
    ALTER TABLE payment_schema.payment_intents
      ADD CONSTRAINT payment_intents_status_check
      CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'CAPTURED',
        'VOID_REQUESTED',
        'VOIDED',
        'FAILED'
      ));
    ALTER TABLE payment_schema.payment_intents
      DROP COLUMN IF EXISTS refund_provider_id,
      DROP COLUMN IF EXISTS refunded_amount;
  `);
};
