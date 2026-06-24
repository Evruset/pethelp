import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { LiveKitService } from './livekit.service';

interface CloseEvent {
  id: string;
  session_id: string;
  room_name: string;
}

@Injectable()
export class TelemedRoomCloseWorker {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly liveKit: LiveKitService,
    private readonly logger: ContextLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relayRoomCloseRequests(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < 10; index += 1) {
        const event = await this.claimOne();
        if (!event) break;
        try {
          await this.liveKit.closeRoom(event.room_name);
          await this.publish(event.id);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'LiveKit room close failed';
          this.logger.event('error', TelemedRoomCloseWorker.name, 'Telemedicine room close failed', {
            telemedSessionId: event.session_id,
            error: reason,
          });
          await this.release(event.id, reason);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async claimOne(): Promise<CloseEvent | undefined> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<CloseEvent>(`
        WITH claimed AS (
          SELECT id
          FROM booking_schema.outbox_events
          WHERE event_type = 'telemed.room.close.requested.v1'
            AND status = 'PENDING'
            AND available_at <= clock_timestamp()
            AND (lease_until IS NULL OR lease_until < clock_timestamp())
          ORDER BY created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE booking_schema.outbox_events e
        SET status = 'LEASED',
            lease_until = clock_timestamp() + interval '30 seconds',
            attempts = attempts + 1
        FROM claimed
        WHERE e.id = claimed.id
        RETURNING e.id,
          e.aggregate_id AS session_id,
          e.payload_json->>'roomName' AS room_name
      `);
      return result.rows[0];
    });
  }

  private async publish(eventId: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PUBLISHED',
          published_at = clock_timestamp(),
          processed_at = clock_timestamp(),
          lease_until = NULL,
          last_error = NULL
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId]);
  }

  private async release(eventId: string, reason: string): Promise<void> {
    await this.database.query(`
      UPDATE booking_schema.outbox_events
      SET status = 'PENDING',
          available_at = clock_timestamp() + interval '5 seconds',
          lease_until = NULL,
          last_error = $2
      WHERE id = $1::uuid AND status = 'LEASED'
    `, [eventId, reason.slice(0, 1000)]);
  }
}
