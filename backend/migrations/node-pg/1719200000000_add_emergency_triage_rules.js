/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_triage_rule_sets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      version text NOT NULL UNIQUE,
      active boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      activated_at timestamptz
    );

    CREATE UNIQUE INDEX IF NOT EXISTS emergency_triage_rule_sets_one_active_idx
      ON clinic_schema.emergency_triage_rule_sets (active)
      WHERE active = true;

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_triage_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id uuid NOT NULL REFERENCES clinic_schema.emergency_triage_rule_sets(id) ON DELETE CASCADE,
      signal_code text NOT NULL,
      species text NOT NULL DEFAULT 'ALL',
      outcome text NOT NULL,
      priority integer NOT NULL,
      required_capabilities text[] NOT NULL DEFAULT '{}',
      owner_message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT emergency_triage_rules_signal_check CHECK (signal_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
      CONSTRAINT emergency_triage_rules_species_check CHECK (species IN ('ALL', 'DOG', 'CAT', 'OTHER')),
      CONSTRAINT emergency_triage_rules_outcome_check CHECK (outcome IN ('EMERGENCY', 'SAME_DAY_CLINIC', 'TELEMED_ELIGIBLE', 'PLANNED_VISIT', 'INSUFFICIENT_DATA')),
      CONSTRAINT emergency_triage_rules_priority_check CHECK (priority > 0),
      CONSTRAINT emergency_triage_rules_unique_signal_species UNIQUE (rule_set_id, signal_code, species)
    );

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_triage_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_set_id uuid NOT NULL REFERENCES clinic_schema.emergency_triage_rule_sets(id),
      species text NOT NULL CHECK (species IN ('DOG', 'CAT', 'OTHER')),
      outcome text NOT NULL CHECK (outcome IN ('EMERGENCY', 'SAME_DAY_CLINIC', 'TELEMED_ELIGIBLE', 'PLANNED_VISIT', 'INSUFFICIENT_DATA')),
      required_capabilities text[] NOT NULL DEFAULT '{}',
      owner_message text NOT NULL,
      disclaimer_accepted boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );

    CREATE TABLE IF NOT EXISTS clinic_schema.emergency_triage_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES clinic_schema.emergency_triage_sessions(id) ON DELETE CASCADE,
      signal_code text NOT NULL,
      selected boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT emergency_triage_answers_signal_check CHECK (signal_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
      CONSTRAINT emergency_triage_answers_unique_signal UNIQUE (session_id, signal_code)
    );

    UPDATE clinic_schema.emergency_triage_rule_sets
    SET active = false
    WHERE version <> 'emergency-red-flags-v1'
      AND active = true;

    WITH rule_set AS (
      INSERT INTO clinic_schema.emergency_triage_rule_sets (version, active, activated_at)
      VALUES ('emergency-red-flags-v1', true, clock_timestamp())
      ON CONFLICT (version) DO UPDATE
      SET active = true,
          activated_at = COALESCE(clinic_schema.emergency_triage_rule_sets.activated_at, clock_timestamp())
      RETURNING id
    )
    INSERT INTO clinic_schema.emergency_triage_rules (
      rule_set_id, signal_code, species, outcome, priority, required_capabilities, owner_message
    )
    SELECT id, signal_code, species, outcome, priority, required_capabilities, owner_message
    FROM rule_set
    CROSS JOIN (VALUES
      ('BREATHING_DISTRESS', 'ALL', 'EMERGENCY', 100, ARRAY['OXYGEN_SUPPORT'], 'Нужно срочно связаться с клиникой, которая принимает тяжёлые случаи.'),
      ('COLLAPSE_OR_UNCONSCIOUS', 'ALL', 'EMERGENCY', 100, ARRAY['OXYGEN_SUPPORT', 'INPATIENT_CARE'], 'Нужно срочно связаться с клиникой, которая принимает тяжёлые случаи.'),
      ('SEIZURE', 'ALL', 'EMERGENCY', 95, ARRAY['OXYGEN_SUPPORT', 'INPATIENT_CARE'], 'Нужна срочная очная помощь и контроль состояния.'),
      ('SEVERE_BLEEDING', 'ALL', 'EMERGENCY', 95, ARRAY['TRAUMA'], 'Нужна срочная очная помощь. Позвоните в клинику перед выездом.'),
      ('MAJOR_TRAUMA', 'ALL', 'EMERGENCY', 95, ARRAY['TRAUMA'], 'Нужна срочная очная помощь. Позвоните в клинику перед выездом.'),
      ('TOXIN_INGESTION', 'ALL', 'EMERGENCY', 90, ARRAY['TOXICOLOGY'], 'При возможном отравлении не ждите онлайн-ответ. Свяжитесь со срочной клиникой.'),
      ('BLOAT_OR_BLOCKED_URINATION', 'ALL', 'EMERGENCY', 90, ARRAY['EMERGENCY_SURGERY', 'INPATIENT_CARE'], 'Нужна срочная очная помощь.'),
      ('PERSISTENT_VOMITING_DIARRHEA', 'ALL', 'SAME_DAY_CLINIC', 60, ARRAY['INPATIENT_CARE'], 'Лучше показать питомца врачу сегодня.'),
      ('PAIN_OR_LAMENESS', 'ALL', 'SAME_DAY_CLINIC', 55, ARRAY['TRAUMA'], 'Лучше показать питомца врачу сегодня.'),
      ('SKIN_EAR_EYE', 'ALL', 'TELEMED_ELIGIBLE', 35, ARRAY[]::text[], 'Можно начать с онлайн-консультации или планового визита.'),
      ('ROUTINE_QUESTION', 'ALL', 'PLANNED_VISIT', 20, ARRAY[]::text[], 'Можно выбрать плановый визит или онлайн-консультацию.')
    ) AS seed(signal_code, species, outcome, priority, required_capabilities, owner_message)
    ON CONFLICT (rule_set_id, signal_code, species) DO UPDATE
    SET outcome = EXCLUDED.outcome,
        priority = EXCLUDED.priority,
        required_capabilities = EXCLUDED.required_capabilities,
        owner_message = EXCLUDED.owner_message;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS clinic_schema.emergency_triage_answers;
    DROP TABLE IF EXISTS clinic_schema.emergency_triage_sessions;
    DROP TABLE IF EXISTS clinic_schema.emergency_triage_rules;
    DROP INDEX IF EXISTS clinic_schema.emergency_triage_rule_sets_one_active_idx;
    DROP TABLE IF EXISTS clinic_schema.emergency_triage_rule_sets;
  `);
};
