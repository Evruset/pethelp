import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface OutboxEvent {
  id: string;
  event_type: string;
  schema_version: number;
  producer: string;
  correlation_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  payload_json: Record<string, unknown>;
  attempts: number;
}

@Injectable()
export class OutboxService {
  constructor(private readonly database: DatabaseService) {}

  async claimBatch(batchSize: number): Promise<OutboxEvent[]> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<OutboxEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE status = 'PENDING'
            AND event_type <> 'mis.reservation.requested.v1'
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
        RETURNING e.id, e.event_type, e.schema_version, e.producer, e.correlation_id, e.aggregate_type, e.aggregate_id,
                  e.aggregate_version, e.payload_json, e.attempts
      `, [batchSize]);
      return result.rows;
    });
  }

  async markPublished(eventId: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED', published_at = clock_timestamp(), lease_until = NULL, last_error = NULL
      WHERE id = $1 AND status = 'LEASED'
    `, [eventId]);
  }

  async releaseForRetry(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '5 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1 AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }
}
