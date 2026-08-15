/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE booking_schema.owner_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_owner_id uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE NO ACTION,
      source_outbox_event_id uuid NOT NULL REFERENCES booking_schema.outbox_events(id) ON DELETE NO ACTION,
      booking_hold_id uuid NOT NULL REFERENCES booking_schema.booking_holds(id) ON DELETE NO ACTION,
      appointment_id uuid REFERENCES booking_schema.appointments(id) ON DELETE NO ACTION,
      notification_type text NOT NULL,
      aggregate_version integer NOT NULL,
      title varchar(160) NOT NULL,
      body varchar(1000) NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT owner_notifications_type_check CHECK (
        notification_type IN ('PENDING_CONFIRMATION','CONFIRMED','REJECTED','CANCELLED','EXPIRED')
      ),
      CONSTRAINT owner_notifications_version_check CHECK (aggregate_version > 0),
      CONSTRAINT owner_notifications_copy_check CHECK (btrim(title) <> '' AND btrim(body) <> ''),
      CONSTRAINT owner_notifications_read_check CHECK (read_at IS NULL OR read_at >= created_at),
      CONSTRAINT owner_notifications_source_recipient_type_key
        UNIQUE (source_outbox_event_id, recipient_owner_id, notification_type),
      CONSTRAINT owner_notifications_id_recipient_key UNIQUE (id, recipient_owner_id)
    );

    CREATE INDEX owner_notifications_owner_created_id_idx
      ON booking_schema.owner_notifications (recipient_owner_id, created_at DESC, id DESC);
    CREATE INDEX owner_notifications_owner_unread_created_id_idx
      ON booking_schema.owner_notifications (recipient_owner_id, created_at DESC, id DESC)
      WHERE read_at IS NULL;

    CREATE TABLE booking_schema.owner_notification_email_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      notification_id uuid NOT NULL,
      recipient_owner_id uuid NOT NULL REFERENCES identity_schema.users(id) ON DELETE NO ACTION,
      status text NOT NULL DEFAULT 'PENDING',
      attempt_count integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      lease_token uuid,
      lease_until timestamptz,
      last_error varchar(500),
      delivered_at timestamptz,
      terminal_failed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT owner_notification_email_delivery_notification_key UNIQUE (notification_id),
      CONSTRAINT owner_notification_email_delivery_notification_owner_fkey
        FOREIGN KEY (notification_id, recipient_owner_id)
        REFERENCES booking_schema.owner_notifications (id, recipient_owner_id)
        ON DELETE NO ACTION,
      CONSTRAINT owner_notification_email_delivery_status_check CHECK (
        status IN ('PENDING','LEASED','RETRY_WAIT','DELIVERED','TERMINAL_FAILED')
      ),
      CONSTRAINT owner_notification_email_delivery_attempt_check CHECK (attempt_count BETWEEN 0 AND 5),
      CONSTRAINT owner_notification_email_delivery_dates_check CHECK (updated_at >= created_at),
      CONSTRAINT owner_notification_email_delivery_lifecycle_check CHECK (
        (status IN ('PENDING','RETRY_WAIT')
          AND lease_token IS NULL AND lease_until IS NULL
          AND delivered_at IS NULL AND terminal_failed_at IS NULL)
        OR
        (status = 'LEASED'
          AND lease_token IS NOT NULL AND lease_until IS NOT NULL
          AND delivered_at IS NULL AND terminal_failed_at IS NULL)
        OR
        (status = 'DELIVERED'
          AND lease_token IS NULL AND lease_until IS NULL
          AND delivered_at IS NOT NULL AND terminal_failed_at IS NULL)
        OR
        (status = 'TERMINAL_FAILED'
          AND lease_token IS NULL AND lease_until IS NULL
          AND delivered_at IS NULL AND terminal_failed_at IS NOT NULL)
      )
    );

    CREATE INDEX owner_notification_email_due_idx
      ON booking_schema.owner_notification_email_deliveries (next_attempt_at, id)
      WHERE status IN ('PENDING','RETRY_WAIT');
    CREATE INDEX owner_notification_email_expired_lease_idx
      ON booking_schema.owner_notification_email_deliveries (lease_until, id)
      WHERE status = 'LEASED';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS booking_schema.owner_notification_email_deliveries;
    DROP TABLE IF EXISTS booking_schema.owner_notifications;
  `);
};
