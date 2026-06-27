/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS telemed_schema.telemed_intakes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES identity_schema.users(id),
      pet_id uuid NOT NULL REFERENCES pet_schema.pets(id),
      category text NOT NULL CHECK (category IN (
        'GENERAL_QUESTION',
        'SKIN_EAR_EYE',
        'NUTRITION',
        'BEHAVIOR',
        'MEDICATION_QUESTION',
        'POST_VISIT_FOLLOW_UP',
        'VOMITING_DIARRHEA',
        'PAIN_LAMENESS',
        'OTHER'
      )),
      symptom_duration text NOT NULL CHECK (symptom_duration IN (
        'LESS_THAN_24H',
        'ONE_TO_THREE_DAYS',
        'MORE_THAN_THREE_DAYS',
        'NO_SYMPTOMS'
      )),
      prior_clinic_visit boolean NOT NULL DEFAULT false,
      emergency_red_flags text[] NOT NULL DEFAULT '{}',
      attachment_refs text[] NOT NULL DEFAULT '{}',
      consent_version text NOT NULL,
      expected_service_level text NOT NULL DEFAULT 'STANDARD' CHECK (expected_service_level IN ('STANDARD', 'EXPRESS')),
      eligibility_outcome text NOT NULL CHECK (eligibility_outcome IN (
        'EMERGENCY',
        'SAME_DAY_CLINIC',
        'TELEMED_ELIGIBLE',
        'INSUFFICIENT_DATA'
      )),
      routing_target text NOT NULL CHECK (routing_target IN (
        'EMERGENCY_ROUTE',
        'CLINIC_BOOKING',
        'TELEMED_PAYMENT_QUEUE',
        'GUIDED_QUESTIONS'
      )),
      guardrails text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE INDEX IF NOT EXISTS telemed_intakes_owner_created_idx
      ON telemed_schema.telemed_intakes (owner_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS telemed_intakes_pet_created_idx
      ON telemed_schema.telemed_intakes (pet_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS telemed_schema.telemed_intakes;
  `);
};
