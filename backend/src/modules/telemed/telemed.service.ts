import { HttpStatus, Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';

export type TelemedSessionState = 'WAITING_FOR_DOCTOR' | 'CONNECTED' | 'COMPLETED' | 'DOCTOR_TIMEOUT';

export interface TelemedSessionResult {
  id: string;
  bookingHoldId: string;
  ownerId: string;
  doctorId: string | null;
  state: TelemedSessionState;
  roomName: string;
  version: number;
  expiresAt: string;
  createdAt: string;
}

export interface DoctorConnectionResult {
  session: TelemedSessionResult;
  accessToken: string;
  tokenExpiresAt: string;
}

interface BookingHoldRow {
  id: string;
  owner_id: string;
  state: string;
}

@Injectable()
export class TelemedService {
  private static readonly WAITING_TTL_MINUTES = 5;
  private static readonly VIDEO_TOKEN_TTL_SECONDS = 30 * 60;

  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
  ) {}

  /**
   * Idempotent activation called from the durable CONFIRMED -> telemed outbox path.
   * The network/video provider is deliberately not called while this transaction is open.
   */
  async startSessionAfterPayment(bookingHoldId: string): Promise<TelemedSessionResult> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const hold = await client.query<BookingHoldRow>(`
        SELECT id, owner_id, state
        FROM booking_schema.booking_holds
        WHERE id = $1::uuid
        FOR SHARE
      `, [bookingHoldId]);

      const holdRow = hold.rows[0];
      if (!holdRow) throw DomainErrors.holdNotFound();
      if (holdRow.state !== 'CONFIRMED') {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_HOLD_NOT_CONFIRMED', 'Telemedicine session can be started only for CONFIRMED hold');
      }

      const roomName = `telemed-${bookingHoldId.replace(/-/g, '')}`;
      const session = await client.query<TelemedSessionResult>(`
        INSERT INTO telemed_schema.telemed_sessions (
          booking_hold_id, owner_id, state, room_name, correlation_id, expires_at
        ) VALUES (
          $1::uuid,
          $2::uuid,
          'WAITING_FOR_DOCTOR',
          $3,
          $4::uuid,
          clock_timestamp() + interval '${TelemedService.WAITING_TTL_MINUTES} minutes'
        )
        ON CONFLICT (booking_hold_id) DO UPDATE
        SET booking_hold_id = EXCLUDED.booking_hold_id,
            correlation_id = COALESCE(telemed_schema.telemed_sessions.correlation_id, EXCLUDED.correlation_id)
        RETURNING
          id,
          booking_hold_id AS "bookingHoldId",
          owner_id AS "ownerId",
          doctor_id AS "doctorId",
          state,
          room_name AS "roomName",
          version,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
      `, [bookingHoldId, holdRow.owner_id, roomName, this.traceContext.getCorrelationId() ?? null]);

      return session.rows[0];
    });
  }

  async connectDoctor(sessionId: string, doctorId: string): Promise<DoctorConnectionResult> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const locked = await client.query<TelemedSessionResult>(`
        SELECT
          id,
          booking_hold_id AS "bookingHoldId",
          owner_id AS "ownerId",
          doctor_id AS "doctorId",
          state,
          room_name AS "roomName",
          version,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
        FROM telemed_schema.telemed_sessions
        WHERE id = $1::uuid
        FOR UPDATE
      `, [sessionId]);

      const session = locked.rows[0];
      if (!session) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
      }
      if (session.state !== 'WAITING_FOR_DOCTOR') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_NOT_JOINABLE', 'Telemedicine session is not waiting for a doctor');
      }

      const updated = await client.query<TelemedSessionResult>(`
        UPDATE telemed_schema.telemed_sessions
        SET state = 'CONNECTED',
            doctor_id = $2::uuid,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
          AND state = 'WAITING_FOR_DOCTOR'
          AND clock_timestamp() < expires_at
        RETURNING
          id,
          booking_hold_id AS "bookingHoldId",
          owner_id AS "ownerId",
          doctor_id AS "doctorId",
          state,
          room_name AS "roomName",
          version,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
      `, [sessionId, doctorId]);

      const connected = updated.rows[0];
      if (!connected) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_DOCTOR_JOIN_TIMEOUT', 'Doctor joined after session SLA deadline');
      }

      const tokenExpiresAt = new Date(Date.now() + TelemedService.VIDEO_TOKEN_TTL_SECONDS * 1000).toISOString();
      return {
        session: connected,
        accessToken: this.createVideoAccessToken({
          sessionId: connected.id,
          roomName: connected.roomName,
          doctorId,
          exp: Math.floor(new Date(tokenExpiresAt).getTime() / 1000),
        }),
        tokenExpiresAt,
      };
    });
  }

  private createVideoAccessToken(payload: { sessionId: string; roomName: string; doctorId: string; exp: number }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      iss: 'vethelp-telemed',
      sub: payload.doctorId,
      aud: 'vethelp-video-room',
      jti: randomUUID(),
      room: payload.roomName,
      sessionId: payload.sessionId,
      exp: payload.exp,
    })).toString('base64url');
    const secret = process.env.TELEMED_TOKEN_SECRET?.trim() || process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'TELEMED_TOKEN_SECRET_NOT_CONFIGURED', 'Telemedicine token signing secret is not configured');
    }
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
