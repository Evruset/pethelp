import { Injectable } from '@nestjs/common';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors, DomainException } from '../common/domain-error';
import { featureFlags } from '../config/feature-flags.config';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { projectMvpBookingStatus, type MvpBookingStatus } from './booking.types';

export interface BookingReplayEvent {
  eventId: string;
  sequence: string;
  eventSequence: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;
  correlationId: string | null;
  causationId: string | null;
  traceparent: string | null;
  payload: Record<string, unknown>;
}

export interface BookingReplayResult {
  holdId: string;
  serverNow: string;
  events: BookingReplayEvent[];
}

export type BookingHistoryEventType = 'BOOKING_REQUESTED' | 'BOOKING_CONFIRMED' | 'BOOKING_REJECTED' | 'BOOKING_CANCELLED' | 'BOOKING_EXPIRED';
export type BookingHistorySource = 'OWNER' | 'CLINIC' | 'SYSTEM';
export interface BookingHistoryEvent {
  eventId: string;
  bookingId: string;
  eventType: BookingHistoryEventType;
  occurredAt: string;
  source: BookingHistorySource;
}
export interface BookingHistoryResult {
  bookingId: string;
  status: MvpBookingStatus;
  lastUpdatedAt: string;
  serverNow: string;
  events: BookingHistoryEvent[];
  nextCursor: { occurredAt: string; eventId: string } | null;
}

const PUBLIC_ACTIONS: Readonly<Record<string, BookingHistoryEventType>> = Object.freeze({
  'booking.hold.created': 'BOOKING_REQUESTED',
  'booking.confirmed': 'BOOKING_CONFIRMED',
  'booking.declined': 'BOOKING_REJECTED',
  'booking.hold.released': 'BOOKING_CANCELLED',
  'booking.hold.expired': 'BOOKING_EXPIRED',
});

@Injectable()
export class BookingEventReplayService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async history(holdId: string, actor: JwtPayload, limit = 50, after?: { occurredAt: string; eventId: string }): Promise<BookingHistoryResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const hold = await client.query<{
        owner_id: string; clinic_location_id: string; clinic_id: string; state: string;
        updated_at: Date; clinic_declined: boolean; server_now: Date;
      }>(`
        SELECT h.owner_id::text, s.clinic_location_id::text, location.clinic_id::text,
               h.state, h.updated_at,
               EXISTS (SELECT 1 FROM audit_schema.audit_log a
                 WHERE a.aggregate_type = 'booking_hold' AND a.aggregate_id = h.id
                   AND a.action = 'booking.declined') AS clinic_declined,
               clock_timestamp() AS server_now
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations location ON location.id = s.clinic_location_id
        WHERE h.id = $1::uuid
        FOR SHARE OF h, s
      `, [holdId]);
      const scope = hold.rows[0];
      if (!scope) throw DomainErrors.holdNotFound();
      if (actor.roles.includes(Role.OWNER)) {
        if (scope.owner_id !== actor.sub) throw DomainErrors.holdNotFound();
      } else {
        try {
          await this.clinicAccess.assertBookingReplayReadAccess(client, actor, scope.clinic_id, scope.clinic_location_id);
        } catch (error) {
          if (error instanceof DomainException && (error.getStatus() === 403 || error.getStatus() === 404)) {
            throw DomainErrors.holdNotFound();
          }
          throw error;
        }
      }
      const status = projectMvpBookingStatus(scope.state as never, scope.clinic_declined);
      if (!status) throw DomainErrors.bookingUnavailable();
      const events = await client.query<{
        id: string; action: string; actor_type: string; occurred_at: Date; correlation_id: string | null;
      }>(`
        SELECT id::text, action, actor_type, occurred_at, correlation_id::text
        FROM audit_schema.audit_log
        WHERE aggregate_type = 'booking_hold' AND aggregate_id = $1::uuid
          AND action = ANY($2::text[])
          AND ($3::timestamptz IS NULL OR (occurred_at, id) > ($3::timestamptz, $4::uuid))
        ORDER BY occurred_at ASC, id ASC
        LIMIT $5
      `, [holdId, Object.keys(PUBLIC_ACTIONS), after?.occurredAt ?? null, after?.eventId ?? null, Math.min(Math.max(1, limit), 100) + 1]);
      const boundedLimit = Math.min(Math.max(1, limit), 100);
      const page = events.rows.slice(0, boundedLimit);
      const last = page.at(-1);
      return {
        bookingId: holdId,
        status,
        lastUpdatedAt: scope.updated_at.toISOString(),
        serverNow: scope.server_now.toISOString(),
        events: page.map((event) => ({
          eventId: event.id,
          bookingId: holdId,
          eventType: PUBLIC_ACTIONS[event.action],
          occurredAt: event.occurred_at.toISOString(),
          source: event.actor_type === 'OWNER' ? 'OWNER'
            : event.actor_type.startsWith('CLINIC') ? 'CLINIC' : 'SYSTEM',
        })),
        nextCursor: events.rows.length > boundedLimit && last
          ? { occurredAt: last.occurred_at.toISOString(), eventId: last.id } : null,
      };
    });
  }

  async replay(
    holdId: string,
    actor: JwtPayload,
    afterVersion = 0,
    afterSequence = 0,
    limit = 50,
  ): Promise<BookingReplayResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");

      const hold = await client.query<{
        owner_id: string;
        clinic_location_id: string;
        clinic_id: string;
      }>(`
        SELECT h.owner_id::text, s.clinic_location_id::text, location.clinic_id::text
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations location ON location.id = s.clinic_location_id
        WHERE h.id = $1::uuid
        FOR SHARE OF h, s
      `, [holdId]);
      const scope = hold.rows[0];
      if (!scope) throw DomainErrors.holdNotFound();

      if (actor.roles.includes(Role.OWNER)) {
        if (scope.owner_id !== actor.sub) throw DomainErrors.holdOwnerMismatch();
      } else if (!actor.roles.includes(Role.SYSTEM_WORKER)) {
        if (featureFlags.BOOKING_REPLAY_READ_CAPABILITY_V1) {
          await this.clinicAccess.assertBookingReplayReadAccess(client, actor, scope.clinic_id, scope.clinic_location_id);
        } else {
          await this.clinicAccess.assertLocationAccess(client, actor, scope.clinic_location_id);
        }
      }

      const events = await client.query<{
        id: string;
        event_sequence: string;
        event_type: string;
        schema_version: number;
        aggregate_type: string;
        aggregate_id: string;
        aggregate_version: number;
        created_at: Date;
        correlation_id: string | null;
        causation_id: string | null;
        traceparent: string | null;
        payload_json: Record<string, unknown>;
      }>(`
        SELECT
          id::text,
          event_sequence::text,
          event_type,
          schema_version,
          aggregate_type,
          aggregate_id::text,
          aggregate_version,
          created_at,
          correlation_id::text,
          causation_id::text,
          traceparent,
          payload_json
        FROM booking_schema.outbox_events
        WHERE aggregate_type = 'booking_hold'
          AND aggregate_id = $1::uuid
          AND aggregate_version > $2
          AND event_sequence > $3
        ORDER BY event_sequence ASC, aggregate_version ASC
        LIMIT $4
      `, [
        holdId,
        Math.max(0, afterVersion),
        Math.max(0, afterSequence),
        Math.min(Math.max(1, limit), 100),
      ]);

      const now = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      return {
        holdId,
        serverNow: now.rows[0].now.toISOString(),
        events: events.rows.map((event) => ({
          eventId: event.id,
          sequence: event.event_sequence,
          eventSequence: event.event_sequence,
          eventType: event.event_type,
          schemaVersion: event.schema_version,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          aggregateVersion: event.aggregate_version,
          occurredAt: event.created_at.toISOString(),
          correlationId: event.correlation_id,
          causationId: event.causation_id,
          traceparent: event.traceparent,
          payload: event.payload_json,
        })),
      };
    });
  }
}
