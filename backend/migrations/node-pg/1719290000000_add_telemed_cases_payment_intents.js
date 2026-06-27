/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_cases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      intake_id uuid NOT NULL UNIQUE REFERENCES telemed_schema.telemed_intakes(id) ON DELETE RESTRICT,
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id),
      state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN (
        'DRAFT',
        'PAYMENT_PENDING',
        'FUNDS_RESERVED',
        'QUEUED',
        'ASSIGNED',
        'DOCTOR_JOINED',
        'IN_PROGRESS',
        'COMPLETED',
        'SETTLED',
        'EXPIRED_NO_DOCTOR',
        'REFUND_PENDING',
        'REFUNDED'
      )),
      urgency_band text NOT NULL DEFAULT 'ROUTINE' CHECK (urgency_band IN ('ROUTINE', 'SOON', 'HIGH')),
      service_level text NOT NULL DEFAULT 'STANDARD' CHECK (service_level IN ('STANDARD', 'EXPRESS')),
      queue_priority integer NOT NULL DEFAULT 0,
      refund_policy_version text NOT NULL DEFAULT 'telemed-refund-v1',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_cases_owner_state_created_idx
      ON telemed_schema.telemed_cases (owner_id, state, created_at DESC);

    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_payment_intents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id uuid NOT NULL UNIQUE REFERENCES telemed_schema.telemed_cases(id) ON DELETE RESTRICT,
      payment_fence_token uuid NOT NULL DEFAULT gen_random_uuid(),
      amount numeric(18, 2) NOT NULL CHECK (amount > 0),
      currency char(3) NOT NULL DEFAULT 'RUB',
      status text NOT NULL CHECK (status IN (
        'PENDING_PROVIDER',
        'CREATED',
        'AUTHORIZED',
        'FAILED',
        'VOID_REQUESTED',
        'VOIDED',
        'REFUND_PENDING',
        'REFUNDED'
      )),
      idempotency_key uuid NOT NULL,
      provider_payment_id varchar(255),
      checkout_url text,
      provider_last_error text,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT telemed_payment_intents_idempotency_uq UNIQUE (idempotency_key)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_payment_intents_fence_token_uq
      ON telemed_schema.telemed_payment_intents (payment_fence_token);

    CREATE UNIQUE INDEX IF NOT EXISTS telemed_payment_intents_provider_payment_id_uq
      ON telemed_schema.telemed_payment_intents (provider_payment_id)
      WHERE provider_payment_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS telemed_schema.telemed_payment_intents;
    DROP TABLE IF EXISTS telemed_schema.telemed_cases;
  `);
};
