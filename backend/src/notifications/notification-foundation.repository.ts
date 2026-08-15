import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type OwnerNotificationType = 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type EmailDeliveryStatus = 'PENDING' | 'LEASED' | 'RETRY_WAIT' | 'DELIVERED' | 'TERMINAL_FAILED';
export type EmailFailureCode = 'TRANSIENT_PROVIDER_FAILURE' | 'INVALID_RECIPIENT' | 'PERMANENT_PROVIDER_REJECTION' | 'UNKNOWN_SAFE';

export interface OwnerNotificationRecord {
  id: string;
  recipientOwnerId: string;
  sourceOutboxEventId: string;
  bookingHoldId: string;
  appointmentId: string | null;
  notificationType: OwnerNotificationType;
  aggregateVersion: number;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ClaimedEmailDelivery {
  id: string;
  notificationId: string;
  recipientOwnerId: string;
  attemptCount: number;
  leaseToken: string;
  leaseUntil: string;
}

const COPY: Record<OwnerNotificationType, { title: string; body: string }> = {
  CONFIRMED: { title: 'Запись подтверждена', body: 'Клиника подтвердила запись.' },
  REJECTED: { title: 'Клиника не подтвердила запись', body: 'Выбранное время не подтверждено клиникой.' },
  CANCELLED: { title: 'Запись отменена', body: 'Запрос на запись отменён.' },
  EXPIRED: { title: 'Срок подтверждения истёк', body: 'Клиника не успела подтвердить запись.' },
};

@Injectable()
export class NotificationFoundationRepository {
  constructor(private readonly database: DatabaseService) {}

  async projectPendingForOwner(ownerId: string, limit = 100): Promise<void> {
    const sources = await this.database.query<{ id: string }>(`
      SELECT event.id::text
      FROM booking_schema.outbox_events event
      JOIN booking_schema.booking_holds hold
        ON event.aggregate_type = 'booking_hold' AND hold.id = event.aggregate_id
      WHERE hold.owner_id = $1::uuid
        AND event.event_type = ANY($2::text[])
        AND (event.event_type <> 'booking.hold.released.v1'
          OR event.payload_json->>'reason' IN ('CLINIC_DECLINED','OWNER_CANCELLED'))
        AND NOT EXISTS (
          SELECT 1 FROM booking_schema.owner_notifications notification
          WHERE notification.source_outbox_event_id = event.id
            AND notification.recipient_owner_id = hold.owner_id
        )
      ORDER BY event.created_at,event.id
      LIMIT $3
    `, [ownerId, ['booking.confirmed.v1', 'booking.hold.released.v1', 'booking.hold.expired.v1'], Math.min(Math.max(1, limit), 100)]);
    for (const source of sources.rows) await this.projectAuthoritativeEvent(source.id);
  }

  async projectPendingBatch(limit = 100): Promise<number> {
    const sources = await this.database.query<{ id: string }>(`
      SELECT event.id::text
      FROM booking_schema.outbox_events event
      JOIN booking_schema.booking_holds hold
        ON event.aggregate_type = 'booking_hold' AND hold.id = event.aggregate_id
      WHERE event.event_type = ANY($1::text[])
        AND (event.event_type <> 'booking.hold.released.v1'
          OR event.payload_json->>'reason' IN ('CLINIC_DECLINED','OWNER_CANCELLED'))
        AND NOT EXISTS (
          SELECT 1 FROM booking_schema.owner_notifications notification
          WHERE notification.source_outbox_event_id = event.id
            AND notification.recipient_owner_id = hold.owner_id
        )
      ORDER BY event.created_at,event.id
      LIMIT $2
    `, [['booking.confirmed.v1', 'booking.hold.released.v1', 'booking.hold.expired.v1'], Math.min(Math.max(1, limit), 100)]);
    let projected = 0;
    for (const source of sources.rows) {
      try {
        await this.projectAuthoritativeEvent(source.id);
        projected += 1;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'NOTIFICATION_EVENT_TYPE_NOT_ALLOWED') throw error;
      }
    }
    return projected;
  }

  async projectAuthoritativeEvent(sourceOutboxEventId: string): Promise<OwnerNotificationRecord> {
    return this.database.withTransaction(async (client) => {
      const source = await client.query<{
        event_id: string; event_type: string; aggregate_version: number; payload_json: Record<string, unknown>;
        hold_id: string; owner_id: string; appointment_id: string | null;
      }>(`
        SELECT event.id AS event_id, event.event_type, event.aggregate_version, event.payload_json,
               hold.id AS hold_id, hold.owner_id,
               appointment.id AS appointment_id
        FROM booking_schema.outbox_events event
        JOIN booking_schema.booking_holds hold
          ON event.aggregate_type = 'booking_hold' AND hold.id = event.aggregate_id
        LEFT JOIN booking_schema.appointments appointment ON appointment.hold_id = hold.id
        WHERE event.id = $1::uuid
        FOR SHARE OF event, hold
      `, [sourceOutboxEventId]);
      const event = source.rows[0];
      if (!event) throw new Error('NOTIFICATION_SOURCE_NOT_FOUND');
      const notificationType = this.notificationType(event.event_type, event.payload_json);
      const copy = COPY[notificationType];

      const inserted = await client.query<{
        id: string; recipient_owner_id: string; source_outbox_event_id: string; booking_hold_id: string;
        appointment_id: string | null; notification_type: OwnerNotificationType; aggregate_version: number;
        title: string; body: string; read_at: Date | null; created_at: Date;
      }>(`
        INSERT INTO booking_schema.owner_notifications (
          recipient_owner_id, source_outbox_event_id, booking_hold_id, appointment_id,
          notification_type, aggregate_version, title, body
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8)
        ON CONFLICT (source_outbox_event_id, recipient_owner_id, notification_type)
        DO UPDATE SET source_outbox_event_id = EXCLUDED.source_outbox_event_id
        RETURNING *
      `, [event.owner_id, event.event_id, event.hold_id, event.appointment_id, notificationType, event.aggregate_version, copy.title, copy.body]);
      const row = inserted.rows[0];
      await client.query(`
        INSERT INTO booking_schema.owner_notification_email_deliveries (notification_id, recipient_owner_id)
        VALUES ($1::uuid,$2::uuid)
        ON CONFLICT (notification_id) DO NOTHING
      `, [row.id, row.recipient_owner_id]);
      return this.toNotification(row);
    });
  }

  async listForOwner(ownerId: string, limit: number): Promise<OwnerNotificationRecord[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const rows = await this.database.query(`
      SELECT * FROM booking_schema.owner_notifications
      WHERE recipient_owner_id=$1::uuid
      ORDER BY created_at DESC,id DESC
      LIMIT $2
    `, [ownerId, boundedLimit]);
    return rows.rows.map((row) => this.toNotification(row as never));
  }

  async markRead(ownerId: string, notificationId: string): Promise<boolean> {
    const result = await this.database.query(`
      UPDATE booking_schema.owner_notifications
      SET read_at=COALESCE(read_at,clock_timestamp())
      WHERE id=$1::uuid AND recipient_owner_id=$2::uuid
    `, [notificationId, ownerId]);
    return result.rowCount === 1;
  }

  async markReadAndGet(ownerId: string, notificationId: string): Promise<OwnerNotificationRecord | undefined> {
    const result = await this.database.query(`
      UPDATE booking_schema.owner_notifications
      SET read_at=COALESCE(read_at,clock_timestamp())
      WHERE id=$1::uuid AND recipient_owner_id=$2::uuid
      RETURNING *
    `, [notificationId, ownerId]);
    return result.rows[0] ? this.toNotification(result.rows[0] as never) : undefined;
  }

  async claimDueEmail(): Promise<ClaimedEmailDelivery | undefined> {
    const result = await this.database.withTransaction(async (client) => {
      await client.query(`
        UPDATE booking_schema.owner_notification_email_deliveries
        SET status='TERMINAL_FAILED',lease_token=NULL,lease_until=NULL,
            terminal_failed_at=clock_timestamp(),last_error='LEASE_EXPIRED_AFTER_MAX_ATTEMPTS',
            updated_at=clock_timestamp()
        WHERE status='LEASED' AND lease_until<clock_timestamp() AND attempt_count>=5
      `);
      return client.query<{
        id: string; notification_id: string; recipient_owner_id: string; attempt_count: number;
        lease_token: string; lease_until: Date;
      }>(`
        WITH candidate AS (
          SELECT id FROM booking_schema.owner_notification_email_deliveries
          WHERE ((status IN ('PENDING','RETRY_WAIT') AND next_attempt_at<=clock_timestamp())
              OR (status='LEASED' AND lease_until<clock_timestamp()))
            AND attempt_count<5
          ORDER BY next_attempt_at,id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE booking_schema.owner_notification_email_deliveries delivery
        SET status='LEASED', attempt_count=attempt_count+1,
            lease_token=gen_random_uuid(), lease_until=clock_timestamp()+interval '30 seconds',
            updated_at=clock_timestamp()
        FROM candidate WHERE delivery.id=candidate.id
        RETURNING delivery.id,delivery.notification_id,delivery.recipient_owner_id,
                  delivery.attempt_count,delivery.lease_token,delivery.lease_until
      `);
    });
    const row = result.rows[0];
    return row ? {
      id: row.id, notificationId: row.notification_id, recipientOwnerId: row.recipient_owner_id,
      attemptCount: row.attempt_count, leaseToken: row.lease_token, leaseUntil: row.lease_until.toISOString(),
    } : undefined;
  }

  async markEmailDelivered(deliveryId: string, leaseToken: string): Promise<boolean> {
    const result = await this.database.query(`
      UPDATE booking_schema.owner_notification_email_deliveries
      SET status='DELIVERED',delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,
          last_error=NULL,updated_at=clock_timestamp()
      WHERE id=$1::uuid AND status='LEASED' AND lease_token=$2::uuid
    `, [deliveryId, leaseToken]);
    return result.rowCount === 1;
  }

  async recordEmailFailure(deliveryId: string, leaseToken: string, failureCode: EmailFailureCode): Promise<EmailDeliveryStatus | undefined> {
    const safeCode: EmailFailureCode = [
      'TRANSIENT_PROVIDER_FAILURE', 'INVALID_RECIPIENT', 'PERMANENT_PROVIDER_REJECTION', 'UNKNOWN_SAFE',
    ].includes(failureCode) ? failureCode : 'UNKNOWN_SAFE';
    const permanent = safeCode === 'INVALID_RECIPIENT' || safeCode === 'PERMANENT_PROVIDER_REJECTION';
    const result = await this.database.query<{ status: EmailDeliveryStatus }>(`
      UPDATE booking_schema.owner_notification_email_deliveries
      SET status=CASE WHEN attempt_count>=5 OR $4::boolean THEN 'TERMINAL_FAILED' ELSE 'RETRY_WAIT' END,
          next_attempt_at=CASE WHEN attempt_count>=5 OR $4::boolean THEN next_attempt_at ELSE clock_timestamp()+interval '5 seconds' END,
          lease_token=NULL,lease_until=NULL,last_error=$3,
          terminal_failed_at=CASE WHEN attempt_count>=5 OR $4::boolean THEN clock_timestamp() ELSE NULL END,
          updated_at=clock_timestamp()
      WHERE id=$1::uuid AND status='LEASED' AND lease_token=$2::uuid
      RETURNING status
    `, [deliveryId, leaseToken, safeCode, permanent]);
    return result.rows[0]?.status;
  }

  private notificationType(eventType: string, payload: Record<string, unknown>): OwnerNotificationType {
    if (eventType === 'booking.confirmed.v1') return 'CONFIRMED';
    if (eventType === 'booking.hold.expired.v1') return 'EXPIRED';
    if (eventType === 'booking.hold.released.v1' && payload.reason === 'CLINIC_DECLINED') return 'REJECTED';
    if (eventType === 'booking.hold.released.v1' && payload.reason === 'OWNER_CANCELLED') return 'CANCELLED';
    throw new Error('NOTIFICATION_EVENT_TYPE_NOT_ALLOWED');
  }

  private toNotification(row: {
    id: string; recipient_owner_id: string; source_outbox_event_id: string; booking_hold_id: string;
    appointment_id: string | null; notification_type: OwnerNotificationType; aggregate_version: number;
    title: string; body: string; read_at: Date | null; created_at: Date;
  }): OwnerNotificationRecord {
    return {
      id: row.id, recipientOwnerId: row.recipient_owner_id, sourceOutboxEventId: row.source_outbox_event_id,
      bookingHoldId: row.booking_hold_id, appointmentId: row.appointment_id,
      notificationType: row.notification_type, aggregateVersion: row.aggregate_version,
      title: row.title, body: row.body, readAt: row.read_at?.toISOString() ?? null, createdAt: row.created_at.toISOString(),
    };
  }
}
