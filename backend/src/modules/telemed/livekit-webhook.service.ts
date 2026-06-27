import { Injectable } from '@nestjs/common';
import type { WebhookEvent } from 'livekit-server-sdk';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { ContextLoggerService } from '../../observability/context-logger.service';
import { TraceContext } from '../../observability/trace-context.context';
import { LiveKitService } from './livekit.service';

interface SessionTraceRow {
  id: string;
  state: string;
  doctor_id: string | null;
  telemed_case_id: string | null;
  correlation_id: string | null;
}

@Injectable()
export class LiveKitWebhookService {
  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
    private readonly logger: ContextLoggerService,
    private readonly liveKitService: LiveKitService,
  ) {}

  async handle(rawBody: string, authorization?: string): Promise<void> {
    const event = await this.liveKitService.receiveWebhook(rawBody, authorization);
    if (event.event === 'participant_joined') {
      await this.handleParticipantJoined(event);
    } else if (event.event === 'room_finished') {
      await this.handleRoomFinished(event);
    } else {
      this.logger.event('debug', LiveKitWebhookService.name, 'LiveKit webhook ignored', { event: event.event });
    }
  }

  private async handleParticipantJoined(event: WebhookEvent): Promise<void> {
    const roomName = event.room?.name;
    const participantIdentity = event.participant?.identity;
    const declaredRole = (event.participant?.attributes as Record<string, string> | undefined)?.role;
    if (!roomName || !participantIdentity) return;

    await this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const session = await this.lockSessionByRoom(client, roomName);
      // The token's optional role attribute is a signal only. The authoritative
      // role check is the server-owned doctor_id attached during connectDoctor.
      if (
        !session
        || session.state !== 'CONNECTED'
        || session.doctor_id !== participantIdentity
        || (declaredRole !== undefined && declaredRole !== 'doctor')
      ) {
        return;
      }

      await this.traceContext.run(this.traceContext.workerContext(session.correlation_id ?? this.traceContext.getCorrelationId()), async () => {
        if (session.telemed_case_id) {
          await client.query(`
            UPDATE telemed_schema.telemed_cases
            SET state = 'IN_PROGRESS',
                updated_at = clock_timestamp()
            WHERE id = $1::uuid
              AND state = 'DOCTOR_JOINED'
          `, [session.telemed_case_id]);
        }

        await client.query(`
          INSERT INTO audit_schema.audit_log (
            occurred_at, actor_type, actor_id, action,
            aggregate_type, aggregate_id, correlation_id, payload_json
          ) VALUES (
            clock_timestamp(), 'DOCTOR', $1::text, 'TELEMED_DOCTOR_JOINED_LIVEKIT',
            'telemed_session', $2::uuid, $3::uuid,
            jsonb_build_object('roomName', $4::text, 'participantIdentity', $1::text, 'role', 'doctor')
          )
        `, [participantIdentity, session.id, this.traceContext.getCorrelationId() ?? null, roomName]);
        this.logger.event('log', LiveKitWebhookService.name, 'Doctor joined LiveKit telemedicine room', {
          telemedSessionId: session.id,
          roomName,
          doctorId: participantIdentity,
        });
      });
    });
  }

  private async handleRoomFinished(event: WebhookEvent): Promise<void> {
    const roomName = event.room?.name;
    if (!roomName) return;

    await this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const session = await this.lockSessionByRoom(client, roomName);
      if (!session) return;

      await this.traceContext.run(this.traceContext.workerContext(session.correlation_id ?? this.traceContext.getCorrelationId()), async () => {
        const result = await client.query<{ id: string }>(`
          UPDATE telemed_schema.telemed_sessions
          SET state = 'COMPLETED',
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
            AND state = 'CONNECTED'
          RETURNING id
        `, [session.id]);

        if (result.rows[0]) {
          if (session.telemed_case_id) {
            await client.query(`
              UPDATE telemed_schema.telemed_cases
              SET state = 'COMPLETED',
                  updated_at = clock_timestamp()
              WHERE id = $1::uuid
                AND state IN ('DOCTOR_JOINED', 'IN_PROGRESS')
            `, [session.telemed_case_id]);
          }

          this.logger.event('log', LiveKitWebhookService.name, 'LiveKit room finished and session completed', {
            telemedSessionId: session.id,
            roomName,
          });
        }
      });
    });
  }

  private async lockSessionByRoom(client: PoolClient, roomName: string): Promise<SessionTraceRow | undefined> {
    const result = await client.query<SessionTraceRow>(`
      SELECT id, state, doctor_id, telemed_case_id, correlation_id
      FROM telemed_schema.telemed_sessions
      WHERE room_name = $1
      FOR UPDATE
    `, [roomName]);
    return result.rows[0];
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
