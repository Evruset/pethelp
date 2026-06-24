/* eslint-disable */
exports.shorthands = undefined;

const entries = [
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
  'REFUND_CONFIRMED',
  'FENCED',
];

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (${entries.map((entry) => `'${entry}'`).join(', ')}));
  `);
};

exports.down = (pgm) => {
  const withoutFenced = entries.filter((entry) => entry !== 'FENCED');
  pgm.sql(`
    ALTER TABLE payment_schema.ledger_entries
      DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
    ALTER TABLE payment_schema.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (${withoutFenced.map((entry) => `'${entry}'`).join(', ')}));
  `);
};
