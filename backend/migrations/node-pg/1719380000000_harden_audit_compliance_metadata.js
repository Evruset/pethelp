/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE audit_schema.audit_log
      ADD COLUMN IF NOT EXISTS causation_id uuid,
      ADD COLUMN IF NOT EXISTS traceparent text,
      ADD COLUMN IF NOT EXISTS actor_ip inet,
      ADD COLUMN IF NOT EXISTS user_agent text,
      ADD COLUMN IF NOT EXISTS event_ref text,
      ADD COLUMN IF NOT EXISTS retained_until timestamptz;

    CREATE UNIQUE INDEX IF NOT EXISTS audit_log_event_ref_idx
      ON audit_schema.audit_log (event_ref)
      WHERE event_ref IS NOT NULL;

    CREATE INDEX IF NOT EXISTS audit_log_correlation_idx
      ON audit_schema.audit_log (correlation_id, occurred_at DESC)
      WHERE correlation_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS audit_log_retention_idx
      ON audit_schema.audit_log (retained_until);

    CREATE OR REPLACE FUNCTION audit_schema.apply_audit_compliance_defaults()
    RETURNS trigger AS $$
    DECLARE
      current_correlation text;
      current_causation text;
      current_traceparent text;
      current_actor_ip text;
      current_user_agent text;
    BEGIN
      IF NEW.event_ref IS NULL THEN
        NEW.event_ref := 'audit:' || NEW.id::text;
      END IF;

      IF NEW.retained_until IS NULL THEN
        NEW.retained_until := NEW.occurred_at + interval '7 years';
      END IF;

      IF NEW.correlation_id IS NULL THEN
        current_correlation := NULLIF(current_setting('app.correlation_id', true), '');
        IF current_correlation IS NOT NULL THEN
          NEW.correlation_id := current_correlation::uuid;
        END IF;
      END IF;

      IF NEW.causation_id IS NULL THEN
        current_causation := NULLIF(current_setting('app.causation_id', true), '');
        IF current_causation IS NOT NULL THEN
          NEW.causation_id := current_causation::uuid;
        END IF;
      END IF;

      IF NEW.traceparent IS NULL THEN
        current_traceparent := NULLIF(current_setting('app.traceparent', true), '');
        IF current_traceparent ~* '^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$' THEN
          NEW.traceparent := lower(current_traceparent);
        END IF;
      END IF;

      IF NEW.actor_ip IS NULL THEN
        current_actor_ip := NULLIF(current_setting('app.actor_ip', true), '');
        IF current_actor_ip IS NOT NULL THEN
          NEW.actor_ip := current_actor_ip::inet;
        END IF;
      END IF;

      IF NEW.user_agent IS NULL THEN
        current_user_agent := NULLIF(current_setting('app.user_agent', true), '');
        IF current_user_agent IS NOT NULL THEN
          NEW.user_agent := left(current_user_agent, 512);
        END IF;
      END IF;

      NEW.payload_json := COALESCE(NEW.payload_json, '{}'::jsonb)
        - 'authorization'
        - 'accessToken'
        - 'refreshToken'
        - 'token'
        - 'password'
        - 'otp'
        - 'code';

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS audit_log_apply_compliance_defaults ON audit_schema.audit_log;
    CREATE TRIGGER audit_log_apply_compliance_defaults
      BEFORE INSERT ON audit_schema.audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_schema.apply_audit_compliance_defaults();

    CREATE OR REPLACE FUNCTION audit_schema.prevent_audit_log_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_schema.audit_log is append-only';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS audit_log_prevent_update ON audit_schema.audit_log;
    CREATE TRIGGER audit_log_prevent_update
      BEFORE UPDATE ON audit_schema.audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_schema.prevent_audit_log_mutation();

    DROP TRIGGER IF EXISTS audit_log_prevent_delete ON audit_schema.audit_log;
    CREATE TRIGGER audit_log_prevent_delete
      BEFORE DELETE ON audit_schema.audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_schema.prevent_audit_log_mutation();

    COMMENT ON TABLE audit_schema.audit_log IS
      'Append-only audit ledger. Updates/deletes are blocked by trigger; retained_until records retention policy.';
    COMMENT ON COLUMN audit_schema.audit_log.event_ref IS
      'Immutable external reference for audit evidence and exports. Existing pre-migration rows may remain NULL until forward-filled by a dedicated maintenance job.';
    COMMENT ON COLUMN audit_schema.audit_log.retained_until IS
      'Audit retention timestamp. Existing pre-migration rows may remain NULL until forward-filled by a dedicated maintenance job.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS audit_log_prevent_delete ON audit_schema.audit_log;
    DROP TRIGGER IF EXISTS audit_log_prevent_update ON audit_schema.audit_log;
    DROP FUNCTION IF EXISTS audit_schema.prevent_audit_log_mutation();

    DROP TRIGGER IF EXISTS audit_log_apply_compliance_defaults ON audit_schema.audit_log;
    DROP FUNCTION IF EXISTS audit_schema.apply_audit_compliance_defaults();

    DROP INDEX IF EXISTS audit_schema.audit_log_retention_idx;
    DROP INDEX IF EXISTS audit_schema.audit_log_correlation_idx;
    DROP INDEX IF EXISTS audit_schema.audit_log_event_ref_idx;

    COMMENT ON COLUMN audit_schema.audit_log.retained_until IS NULL;
    COMMENT ON COLUMN audit_schema.audit_log.event_ref IS NULL;
    COMMENT ON TABLE audit_schema.audit_log IS NULL;

    ALTER TABLE audit_schema.audit_log
      DROP COLUMN IF EXISTS retained_until,
      DROP COLUMN IF EXISTS event_ref,
      DROP COLUMN IF EXISTS user_agent,
      DROP COLUMN IF EXISTS actor_ip,
      DROP COLUMN IF EXISTS traceparent,
      DROP COLUMN IF EXISTS causation_id;
  `);
};
