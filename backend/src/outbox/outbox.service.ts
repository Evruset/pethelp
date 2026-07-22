import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface OutboxEvent {
  id: string;
  event_type: string;
  schema_version: number;
  producer: string;
  correlation_id: string | null;
  causation_id: string | null;
  traceparent: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  payload_json: Record<string, unknown>;
  attempts: number;
  lease_token: string;
}

export interface OutboxRetryResult {
  terminal: boolean;
  attempts: number;
}

const MAX_DELIVERY_ATTEMPTS = 5;

@Injectable()
export class OutboxService {
  constructor(private readonly database: DatabaseService) {}

  async claimBatch(batchSize: number): Promise<OutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<OutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE (status = 'PENDING' OR (status = 'LEASED' AND lease_until < clock_timestamp()))
            AND event_type NOT IN (
              'mis.reservation.requested.v1',
              'payment.acquiring.void.requested.v1',
              'payment.acquiring.capture.requested.v1',
              'telemed.session.start.requested.v1'
            )
            AND available_at <= clock_timestamp()
            AND (lease_until IS NULL OR lease_until < clock_timestamp())
          ORDER BY id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE booking_schema.outbox_events e
        SET status = 'LEASED',
            lease_until = clock_timestamp() + interval '30 seconds',
            attempts = attempts + 1
        FROM claimed
        WHERE e.id = claimed.id
        RETURNING e.id, e.event_type, e.schema_version, e.producer, e.correlation_id, e.causation_id, e.traceparent, e.aggregate_type, e.aggregate_id,
                  e.aggregate_version, e.payload_json, e.attempts, e.lease_until::text AS lease_token
      `, [batchSize]);
      return result.rows;
    });
  }

  async markPublished(eventId: string, leaseToken: string): Promise<boolean> {
    const result = await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED', published_at = clock_timestamp(), lease_until = NULL, last_error = NULL
      WHERE id = $1 AND status = 'LEASED' AND lease_until = $2::timestamptz
    `, [eventId, leaseToken]);
    return result.rowCount === 1;
  }

  async releaseForRetry(eventId: string, leaseToken: string, reason: string): Promise<OutboxRetryResult | undefined> {
    const result = await this.database.query<{ status: string; attempts: number }>(`
      UPDATE booking_schema.outbox_events
      SET status = CASE WHEN attempts >= $3 THEN 'FAILED' ELSE 'PENDING' END,
          available_at = CASE
            WHEN attempts >= $3 THEN available_at
            ELSE clock_timestamp() + interval '5 seconds'
          END,
          lease_until = NULL,
          last_error = $2
      WHERE id = $1 AND status = 'LEASED' AND lease_until = $4::timestamptz
      RETURNING status, attempts
    `, [eventId, reason.slice(0, 1000), MAX_DELIVERY_ATTEMPTS, leaseToken]);
    if (!result.rows[0]) return undefined;
    return {
      terminal: result.rows[0].status === 'FAILED',
      attempts: result.rows[0].attempts,
    };
  }
}
