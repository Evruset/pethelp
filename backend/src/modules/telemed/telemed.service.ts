import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainException, DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TraceContext } from '../../observability/trace-context.context';
import { LiveKitService } from './livekit.service';

export type TelemedSessionState = 'WAITING_FOR_DOCTOR' | 'CONNECTED' | 'COMPLETED' | 'DOCTOR_TIMEOUT';

export interface TelemedSessionResult {
  id: string;
  bookingHoldId: string | null;
  telemedCaseId: string | null;
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
  livekitUrl: string;
}

interface BookingHoldRow {
  id: string;
  owner_id: string;
  state: string;
}

interface TelemedCaseForSessionRow {
  id: string;
  owner_id: string;
  state: string;
  assigned_employee_id: string | null;
}

@Injectable()
export class TelemedService {
  private static readonly WAITING_TTL_MINUTES = 5;
  private static readonly VIDEO_TOKEN_TTL_SECONDS = 30 * 60;

  constructor(
    private readonly database: DatabaseService,
    private readonly traceContext: TraceContext,
    private readonly liveKitService: LiveKitService,
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
          telemed_case_id AS "telemedCaseId",
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

  async startSessionForCase(caseId: string, doctorId: string): Promise<TelemedSessionResult> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const telemedCase = await client.query<TelemedCaseForSessionRow>(`
        SELECT id, owner_id, state, assigned_employee_id
        FROM telemed_schema.telemed_cases
        WHERE id = $1::uuid
        FOR UPDATE
      `, [caseId]);
      const row = telemedCase.rows[0];
      if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_CASE_NOT_FOUND', 'Telemedicine case not found');
      if (row.assigned_employee_id !== doctorId) {
        throw new DomainException(HttpStatus.FORBIDDEN, 'TELEMED_CASE_ASSIGNEE_MISMATCH', 'Telemedicine case is assigned to another employee');
      }
      if (row.state !== 'ASSIGNED' && row.state !== 'DOCTOR_JOINED') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_CASE_NOT_READY_FOR_SESSION', 'Telemedicine case must be assigned before session start');
      }

      const roomName = `telemed-case-${caseId.replace(/-/g, '')}`;
      const session = await client.query<TelemedSessionResult>(`
        INSERT INTO telemed_schema.telemed_sessions (
          telemed_case_id, owner_id, state, room_name, correlation_id, expires_at
        ) VALUES (
          $1::uuid,
          $2::uuid,
          'WAITING_FOR_DOCTOR',
          $3,
          $4::uuid,
          clock_timestamp() + interval '${TelemedService.WAITING_TTL_MINUTES} minutes'
        )
        ON CONFLICT (telemed_case_id) DO UPDATE
        SET telemed_case_id = EXCLUDED.telemed_case_id,
            correlation_id = COALESCE(telemed_schema.telemed_sessions.correlation_id, EXCLUDED.correlation_id)
        RETURNING
          id,
          booking_hold_id AS "bookingHoldId",
          telemed_case_id AS "telemedCaseId",
          owner_id AS "ownerId",
          doctor_id AS "doctorId",
          state,
          room_name AS "roomName",
          version,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
      `, [caseId, row.owner_id, roomName, this.traceContext.getCorrelationId() ?? null]);

      await client.query(`
        UPDATE telemed_schema.telemed_cases
        SET state = 'DOCTOR_JOINED', updated_at = clock_timestamp()
        WHERE id = $1::uuid AND state = 'ASSIGNED'
      `, [caseId]);
      await client.query(`
        INSERT INTO telemed_schema.telemed_case_events (case_id, actor_type, actor_id, event_type, payload_json)
        VALUES ($1::uuid, 'TELEMED_VETERINARIAN', $2::uuid, 'SESSION_STARTED', jsonb_build_object('sessionId', $3::uuid))
      `, [caseId, doctorId, session.rows[0].id]);

      return session.rows[0];
    });
  }

  async connectDoctor(sessionId: string, doctorId: string): Promise<DoctorConnectionResult> {
    const connected = await this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const locked = await client.query<TelemedSessionResult>(`
        SELECT
          id,
          booking_hold_id AS "bookingHoldId",
          telemed_case_id AS "telemedCaseId",
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
          telemed_case_id AS "telemedCaseId",
          owner_id AS "ownerId",
          doctor_id AS "doctorId",
          state,
          room_name AS "roomName",
          version,
          expires_at AS "expiresAt",
          created_at AS "createdAt"
      `, [sessionId, doctorId]);

      const result = updated.rows[0];
      if (!result) {
        throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'TELEMED_DOCTOR_JOIN_TIMEOUT', 'Doctor joined after session SLA deadline');
      }
      return result;
    });

    // Native LiveKit signing is intentionally after the database commit: no
    // provider SDK work is performed while the session row is locked.
    const accessToken = await this.liveKitService.generateLiveKitToken(connected.roomName, doctorId, true);
    const tokenExpiresAt = new Date(Date.now() + TelemedService.VIDEO_TOKEN_TTL_SECONDS * 1000).toISOString();
    return {
      session: connected,
      accessToken,
      tokenExpiresAt,
      livekitUrl: this.liveKitService.apiUrl(),
    };
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }
}
