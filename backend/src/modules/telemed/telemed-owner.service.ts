import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { LiveKitService } from './livekit.service';

export type OwnerTelemedState = 'WAITING_FOR_DOCTOR' | 'CONNECTED' | 'COMPLETED' | 'DOCTOR_TIMEOUT';
export type OwnerRefundState = 'NOT_APPLICABLE' | 'VOID_REQUESTED' | 'VOIDED' | 'REFUND_REQUESTED' | 'REFUNDED';

export interface OwnerTelemedSnapshot {
  sessionId: string;
  state: OwnerTelemedState;
  version: number;
  doctorJoinDeadlineAt: string;
  serverNow: string;
  endRequested: boolean;
  refundState: OwnerRefundState;
}

export interface OwnerRoomToken {
  sessionId: string;
  roomName: string;
  accessToken: string;
  tokenExpiresAt: string;
  livekitUrl: string;
  version: number;
}

interface SessionRow {
  id: string;
  owner_id: string;
  state: OwnerTelemedState;
  version: number;
  room_name: string;
  expires_at: Date;
  ending_requested_at: Date | null;
  payment_status: string | null;
}

@Injectable()
export class TelemedOwnerService {
  constructor(
    private readonly database: DatabaseService,
    private readonly liveKit: LiveKitService,
  ) {}

  async read(sessionId: string, ownerId: string): Promise<OwnerTelemedSnapshot> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const session = await this.findSession(client, sessionId, false);
      this.assertOwner(session, ownerId);
      const now = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      return this.snapshot(session, now.rows[0].now);
    });
  }

  async issueRoomToken(sessionId: string, ownerId: string): Promise<OwnerRoomToken> {
    const session = await this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const locked = await this.findSession(client, sessionId, true);
      this.assertOwner(locked, ownerId);
      if (locked.state !== 'CONNECTED') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_NOT_CONNECTED', 'Telemedicine session is not connected');
      }
      if (locked.ending_requested_at) {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_SESSION_ENDING', 'Telemedicine room is closing');
      }
      return locked;
    });

    return {
      sessionId,
      roomName: session.room_name,
      accessToken: await this.liveKit.generateLiveKitToken(session.room_name, ownerId, false),
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      livekitUrl: this.liveKit.apiUrl(),
      version: session.version,
    };
  }

  private async findSession(client: PoolClient, sessionId: string, lock: boolean): Promise<SessionRow> {
    const result = await client.query<SessionRow>(`
      SELECT s.id, s.owner_id, s.state, s.version, s.room_name, s.expires_at,
             s.ending_requested_at, p.status AS payment_status
      FROM telemed_schema.telemed_sessions s
      LEFT JOIN LATERAL (
        SELECT status FROM payment_schema.payment_intents
        WHERE hold_id = s.booking_hold_id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.id = $1::uuid
      ${lock ? 'FOR UPDATE OF s' : 'FOR SHARE OF s'}
    `, [sessionId]);
    const session = result.rows[0];
    if (!session) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
    return session;
  }

  private assertOwner(session: SessionRow, ownerId: string): void {
    if (session.owner_id !== ownerId) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'TELEMED_SESSION_OWNER_MISMATCH', 'Telemedicine session owner mismatch');
    }
  }

  private snapshot(session: SessionRow, serverNow: Date): OwnerTelemedSnapshot {
    return {
      sessionId: session.id,
      state: session.state,
      version: session.version,
      doctorJoinDeadlineAt: session.expires_at.toISOString(),
      serverNow: serverNow.toISOString(),
      endRequested: session.ending_requested_at !== null,
      refundState: this.refundState(session.state, session.payment_status),
    };
  }

  private refundState(state: OwnerTelemedState, paymentStatus: string | null): OwnerRefundState {
    if (state !== 'DOCTOR_TIMEOUT') return 'NOT_APPLICABLE';
    if (paymentStatus === 'VOIDED') return 'VOIDED';
    if (paymentStatus === 'REFUNDED') return 'REFUNDED';
    if (paymentStatus === 'REFUND_SENT') return 'REFUND_REQUESTED';
    return 'VOID_REQUESTED';
  }
}
