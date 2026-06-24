import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';

export interface OwnerEndRequest {
  sessionId: string;
  state: 'ENDING' | 'COMPLETED';
  version: number;
}

interface EndSessionRow {
  id: string;
  owner_id: string;
  state: string;
  version: number;
  room_name: string;
}

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_body: Record<string, unknown> | null;
}

@Injectable()
export class TelemedOwnerEndService {
  constructor(private readonly database: DatabaseService) {}

  async requestEnd(input: {
    sessionId: string;
    ownerId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<OwnerEndRequest> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const scope = `telemed.owner.end:${input.ownerId}`;
      const replay = await this.acquire(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as OwnerEndRequest;

      const session = await this.lockSession(client, input.sessionId);
      if (session.owner_id !== input.ownerId) {
        throw new DomainException(HttpStatus.FORBIDDEN, 'TELEMED_SESSION_OWNER_MISMATCH', 'Telemedicine session owner mismatch');
      }
      if (session.state === 'COMPLETED') {
        const result: OwnerEndRequest = { sessionId: session.id, state: 'COMPLETED', version: session.version };
        await this.complete(client, scope, input.idempotencyKey, result);
        return result;
      }
      if (session.state !== 'CONNECTED') {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_SESSION_NOT_ENDABLE', 'Telemedicine session cannot be ended now');
      }

      const updated = await client.query<{ version: number }>(`
        UPDATE telemed_schema.telemed_sessions
        SET ending_requested_at = COALESCE(ending_requested_at, clock_timestamp()),
            ending_requested_by = COALESCE(ending_requested_by, $2::uuid),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING version
      `, [session.id, input.ownerId]);
      const result: OwnerEndRequest = { sessionId: session.id, state: 'ENDING', version: updated.rows[0].version };

      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, aggregate_type, aggregate_id,
          aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'telemed.room.close.requested.v1', $1::uuid, 'telemed_session', $2::uuid,
          $3, jsonb_build_object('telemedSessionId', $2::uuid, 'roomName', $4), $5
        ) ON CONFLICT (deduplication_key) DO NOTHING
      `, [input.correlationId, session.id, result.version, session.room_name, `telemed.room.close.requested.v1:${session.id}`]);
      await client.query(`
        INSERT INTO audit_schema.audit_log (
          actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json
        ) VALUES (
          'OWNER', $1::uuid, 'TELEMED_OWNER_END_REQUESTED', 'telemed_session', $2::uuid, $3::uuid,
          jsonb_build_object('roomName', $4)
        )
      `, [input.ownerId, session.id, input.correlationId, session.room_name]);
      await this.complete(client, scope, input.idempotencyKey, result);
      return result;
    });
  }

  private async lockSession(client: PoolClient, sessionId: string): Promise<EndSessionRow> {
    const result = await client.query<EndSessionRow>(`
      SELECT id, owner_id, state, version, room_name
      FROM telemed_schema.telemed_sessions
      WHERE id = $1::uuid
      FOR UPDATE
    `, [sessionId]);
    const session = result.rows[0];
    if (!session) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
    return session;
  }

  private async acquire(client: PoolClient, scope: string, key: string): Promise<Record<string, unknown> | null> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING')
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key]);
    if (inserted.rows[0]) return null;
    const current = await client.query<IdempotencyRow>(`
      SELECT status, response_body
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, key]);
    if (current.rows[0]?.status === 'COMPLETED' && current.rows[0].response_body) return current.rows[0].response_body;
    throw new DomainException(425, 'IDEMPOTENCY_IN_PROGRESS', 'Telemedicine command is in progress');
  }

  private async complete(client: PoolClient, scope: string, key: string, result: OwnerEndRequest): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = 202, response_body = $3::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, key, JSON.stringify(result)]);
  }
}
