import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { DomainErrors, DomainException } from '../common/domain-error';
import { config } from '../config';
import { featureFlags } from '../config/feature-flags.config';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';
import { canTransition } from './booking-state-machine';
import { BookingRepository } from './booking.repository';
import { CreateHoldResult, HoldRow, HoldState, RequestCancellationResult } from './booking.types';

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  request_fingerprint: string | null;
}

interface PetOwnershipRow {
  owner_id: string;
  external_patient_id: string | null;
  archived_at: Date | null;
}

interface ClinicMisRow {
  clinic_id: string;
  mis_type: string | null;
  clinic_status: string;
  location_status: string;
}

const ACTIVE_HOLD_STATES: HoldState[] = [
  'MANUAL_CONFIRM_PENDING',
  'ALTERNATIVE_PENDING',
  'MIS_RESERVATION_PENDING',
  'MIS_RECONCILIATION_PENDING',
  'MIS_HELD',
  'PAYMENT_PENDING',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_RECONCILIATION_PENDING',
  'CONFIRMED',
  'CANCELLATION_REQUESTED',
  'RESCHEDULE_REQUESTED',
];

@Injectable()
export class BookingHoldCreationService {
  private readonly logger = new Logger(BookingHoldCreationService.name);
  private readonly traceContext = new TraceContext();

  constructor(
    private readonly database: DatabaseService,
    private readonly repository: BookingRepository,
  ) {}

  async createLocalHold(input: {
    slotId: string;
    ownerId: string;
    petId: string;
    idempotencyKey: string;
    correlationId: string;
    expectedSlotVersion?: number;
    serviceId?: string;
    doctorId: string | null;
  }): Promise<CreateHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);

        const idempotencyScope = `booking.create-local-hold:${input.ownerId}`;
        const fingerprint = this.requestFingerprint(input);
        const existing = await this.acquireIdempotency(client, idempotencyScope, input.idempotencyKey, fingerprint);
        if (existing) return existing as unknown as CreateHoldResult;

        // Global interactive lock order: pet, then slot.
        const pet = await client.query<PetOwnershipRow>(`
          SELECT owner_id, external_patient_id, archived_at
          FROM pet_schema.pets
          WHERE id = $1
          FOR SHARE
        `, [input.petId]);
        if (!pet.rows[0] || pet.rows[0].owner_id !== input.ownerId || pet.rows[0].archived_at !== null) {
          throw DomainErrors.petOwnershipMismatch();
        }

        const slot = await this.repository.lockSlot(client, input.slotId);
        if (!slot) throw DomainErrors.slotNotFound();

        const now = await this.repository.now(client);

        await this.assertNoActiveHoldForSlot(client, input.ownerId, input.slotId, now);

        if (input.expectedSlotVersion !== undefined && slot.version !== input.expectedSlotVersion) throw DomainErrors.slotVersionStale();
        if (input.serviceId !== undefined && slot.service_id !== input.serviceId) throw DomainErrors.serviceNotAvailable();
        if ((slot.doctor_id ?? null) !== input.doctorId) throw DomainErrors.doctorNotAvailable();
        if (slot.state !== 'OPEN' || slot.starts_at <= now) throw DomainErrors.slotUnavailable();
        if (slot.status === 'BOOKED' || slot.capacity - slot.booked_count - slot.held_count <= 0) {
          throw DomainErrors.slotAlreadyTaken();
        }

        const clinic = await client.query<ClinicMisRow>(`
          SELECT c.id AS clinic_id, c.mis_type, c.status AS clinic_status, l.status AS location_status
          FROM clinic_schema.clinic_locations l
          JOIN clinic_schema.clinics c ON c.id = l.clinic_id
          WHERE l.id = $1::uuid
        `, [slot.clinic_location_id]);
        if (!clinic.rows[0]) throw DomainErrors.slotNotFound();
        if (clinic.rows[0].clinic_status !== 'ACTIVE' || clinic.rows[0].location_status !== 'ACTIVE') {
          throw DomainErrors.slotUnavailable();
        }

        const service = await client.query<{ active: boolean; clinic_location_id: string }>(`
          SELECT active, clinic_location_id::text
          FROM clinic_schema.clinic_services
          WHERE id = $1::uuid
        `, [slot.service_id]);
        if (!service.rows[0]?.active || service.rows[0].clinic_location_id !== slot.clinic_location_id) {
          throw DomainErrors.serviceNotAvailable();
        }

        const integrationMode = slot.integration_mode ?? (clinic.rows[0].mis_type ? 'LEVEL_A' : 'LEVEL_C');
        const requiresMisReservation = featureFlags.FEATURE_MIS_INTEGRATION && integrationMode !== 'LEVEL_C';
        if (requiresMisReservation && !pet.rows[0].external_patient_id) {
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'EXTERNAL_PATIENT_MAPPING_REQUIRED',
            'Pet is not mapped to an external MIS patient',
          );
        }

        const initialState: HoldState = requiresMisReservation
          ? 'MIS_RESERVATION_PENDING'
          : 'CONFIRMED';

        /*
         * Manual SLA fields are kept for legacy/manual states. Owner catalog
         * Level-C booking is finalized atomically below and does not enter the
         * clinic confirmation queue.
         */
        const hold = await client.query<HoldRow>(`
          INSERT INTO booking_schema.booking_holds (
            slot_id, owner_id, pet_id, state, expires_at, confirmation_sla_expires_at
          )
          VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4,
            CASE
              WHEN $4 = 'MANUAL_CONFIRM_PENDING' THEN clock_timestamp() + interval '16 minutes'
              ELSE clock_timestamp() + ($5::text || ' minutes')::interval
            END,
            CASE
              WHEN $4 = 'MANUAL_CONFIRM_PENDING' THEN clock_timestamp() + interval '15 minutes'
              ELSE NULL
            END
          )
          RETURNING
            id, slot_id, owner_id, pet_id, state, expires_at,
            confirmation_sla_expires_at, alternative_slot_id, alternative_expires_at,
            state_changed_at, version, created_at
        `, [input.slotId, input.ownerId, input.petId, initialState, config.holdTtlMinutes]);

        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count + CASE WHEN $2 = 'CONFIRMED' THEN 0 ELSE 1 END,
              booked_count = booked_count + CASE WHEN $2 = 'CONFIRMED' THEN 1 ELSE 0 END,
              status = CASE
                WHEN $2 = 'CONFIRMED' THEN 'BOOKED'
                ELSE 'LOCKED_BY_HOLD'
              END,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
        `, [input.slotId, initialState]);

        const result: CreateHoldResult = {
          holdId: hold.rows[0].id,
          state: initialState,
          slotId: input.slotId,
          expiresAt: hold.rows[0].expires_at.toISOString(),
          correlationId: input.correlationId,
          serverNow: now.toISOString(),
          aggregateVersion: hold.rows[0].version,
          confirmationMode: initialState === 'CONFIRMED' ? 'AUTOMATIC' : requiresMisReservation ? 'MIS' : 'MANUAL',
          nextAction: 'READ_STATUS',
        };

        await this.writeOutbox(client, 'booking.hold.created.v1', input.correlationId, hold.rows[0].id, hold.rows[0].version, {
          holdId: hold.rows[0].id,
          slotId: input.slotId,
          ownerId: input.ownerId,
          petId: input.petId,
          state: initialState,
          integrationMode,
          expiresAt: result.expiresAt,
          confirmationSlaExpiresAt: hold.rows[0].confirmation_sla_expires_at?.toISOString() ?? null,
        });

        if (initialState === 'CONFIRMED') {
          const appointment = await client.query<{ id: string }>(`
            INSERT INTO booking_schema.appointments (hold_id, owner_id, pet_id, clinic_location_id, slot_id)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)
            ON CONFLICT (hold_id) DO UPDATE
            SET updated_at = clock_timestamp()
            RETURNING id
          `, [hold.rows[0].id, input.ownerId, input.petId, slot.clinic_location_id, input.slotId]);
          await client.query(`
            INSERT INTO booking_schema.appointment_events (
              appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json
            ) VALUES ($1::uuid, $2::uuid, 'CONFIRMED', 'OWNER', $3::uuid, $4::uuid, $5::jsonb)
          `, [
            appointment.rows[0].id,
            hold.rows[0].id,
            input.ownerId,
            input.correlationId,
            JSON.stringify({ slotId: input.slotId, clinicLocationId: slot.clinic_location_id, autoApproved: true }),
          ]);
          result.appointmentId = appointment.rows[0].id;
          await this.writeOutbox(client, 'booking.confirmed.v1', input.correlationId, hold.rows[0].id, hold.rows[0].version, {
            holdId: hold.rows[0].id,
            appointmentId: appointment.rows[0].id,
            state: 'CONFIRMED',
            slotId: input.slotId,
            ownerId: input.ownerId,
            petId: input.petId,
            clinicLocationId: slot.clinic_location_id,
            autoApproved: true,
          });
        }

        if (requiresMisReservation) {
          await this.writeOutbox(
            client,
            'mis.reservation.requested.v1',
            input.correlationId,
            hold.rows[0].id,
            hold.rows[0].version,
            {
              holdId: hold.rows[0].id,
              slotId: input.slotId,
              clinicId: clinic.rows[0].clinic_id,
              externalPatientId: pet.rows[0].external_patient_id,
              correlationId: input.correlationId,
            },
          );
        }

        await client.query(`
          INSERT INTO audit_schema.audit_log (
            actor_type, actor_id, action, aggregate_type,
            aggregate_id, correlation_id, payload_json
          ) VALUES ($1, $2, $3, 'booking_hold', $4::uuid, $5::uuid, $6::jsonb)
        `, [
          'OWNER',
          input.ownerId,
          'booking.hold.created',
          hold.rows[0].id,
          input.correlationId,
          JSON.stringify({
            slotId: input.slotId,
            petId: input.petId,
            state: initialState,
            integrationMode,
            confirmationSlaExpiresAt: hold.rows[0].confirmation_sla_expires_at?.toISOString() ?? null,
          }),
        ]);

        await this.completeIdempotency(
          client,
          idempotencyScope,
          input.idempotencyKey,
          result,
          HttpStatus.CREATED,
        );

        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async requestCancellation(input: {
    holdId: string;
    ownerId: string;
    correlationId: string;
  }): Promise<RequestCancellationResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);

        const locked = await client.query<{
          id: string;
          slot_id: string;
          owner_id: string;
          state: HoldState;
          version: number;
        }>(`
          SELECT id, slot_id, owner_id, state, version
          FROM booking_schema.booking_holds
          WHERE id = $1::uuid
          FOR UPDATE
        `, [input.holdId]);
        const hold = locked.rows[0];
        if (!hold) throw DomainErrors.holdNotFound();
        if (hold.owner_id !== input.ownerId) throw DomainErrors.holdOwnerMismatch();

        if (hold.state === 'CANCELLATION_REQUESTED') {
          return {
            holdId: hold.id,
            state: 'CANCELLATION_REQUESTED',
            slotId: hold.slot_id,
            correlationId: input.correlationId,
          };
        }
        if (!canTransition(hold.state, 'CANCELLATION_REQUESTED')) {
          throw DomainErrors.invalidTransition();
        }

        const updated = await client.query<{ version: number }>(`
          UPDATE booking_schema.booking_holds
          SET state = 'CANCELLATION_REQUESTED',
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING version
        `, [hold.id]);

        const result: RequestCancellationResult = {
          holdId: hold.id,
          state: 'CANCELLATION_REQUESTED',
          slotId: hold.slot_id,
          correlationId: input.correlationId,
        };
        await this.writeOutbox(
          client,
          'support.ticket.cancellation_requested.v1',
          input.correlationId,
          hold.id,
          updated.rows[0].version,
          {
            holdId: hold.id,
            slotId: hold.slot_id,
            ownerId: input.ownerId,
            previousState: hold.state,
          },
        );
        await client.query(`
          INSERT INTO audit_schema.audit_log (
            actor_type, actor_id, action, aggregate_type,
            aggregate_id, correlation_id, payload_json
          ) VALUES ('OWNER', $1, 'booking.cancellation_requested', 'booking_hold', $2::uuid, $3::uuid, $4::jsonb)
        `, [
          input.ownerId,
          hold.id,
          input.correlationId,
          JSON.stringify({ slotId: hold.slot_id, previousState: hold.state }),
        ]);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async assertNoActiveHoldForSlot(
    client: PoolClient,
    ownerId: string,
    slotId: string,
    now: Date,
  ): Promise<void> {
    const existing = await client.query<{ id: string }>(`
      SELECT id
      FROM booking_schema.booking_holds
      WHERE owner_id = $1::uuid
        AND slot_id = $2::uuid
        AND state = ANY($3::text[])
        AND (state = 'CONFIRMED' OR expires_at > $4::timestamptz)
      LIMIT 1
    `, [ownerId, slotId, ACTIVE_HOLD_STATES, now]);
    if (existing.rows[0]) throw DomainErrors.holdAlreadyActive();
  }

  private async acquireIdempotency(
    client: PoolClient,
    scope: string,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status, request_fingerprint)
      VALUES ($1, $2::uuid, 'PROCESSING', $3)
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, idempotencyKey, requestFingerprint]);

    if (inserted.rows[0]) return undefined;

    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_status, response_body, request_fingerprint
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, idempotencyKey]);

    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
    if (existing.rows[0].request_fingerprint !== null && existing.rows[0].request_fingerprint !== requestFingerprint) {
      throw DomainErrors.idempotencyPayloadConflict();
    }
    if (existing.rows[0].status !== 'COMPLETED' || !existing.rows[0].response_body) {
      throw DomainErrors.idempotencyInProgress();
    }
    if ((existing.rows[0].response_status ?? 200) >= 400) {
      const body = existing.rows[0].response_body as { code?: string; message?: string };
      throw new DomainException(
        existing.rows[0].response_status ?? HttpStatus.CONFLICT,
        body.code ?? 'IDEMPOTENT_REQUEST_FAILED',
        body.message ?? 'Previous request failed',
      );
    }
    return existing.rows[0].response_body;
  }

  private requestFingerprint(input: {
    slotId: string; petId: string; serviceId?: string; doctorId: string | null; expectedSlotVersion?: number;
  }): string {
    const canonical = JSON.stringify({
      doctorId: input.doctorId,
      expectedSlotVersion: input.expectedSlotVersion,
      petId: input.petId,
      serviceId: input.serviceId,
      slotId: input.slotId,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private async completeIdempotency(
    client: PoolClient,
    scope: string,
    idempotencyKey: string,
    response: unknown,
    status: number,
  ): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED',
          response_status = $3,
          response_body = $4::jsonb,
          updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, idempotencyKey, status, JSON.stringify(response)]);
  }

  private async writeOutbox(
    client: PoolClient,
    eventType: string,
    correlationId: string,
    aggregateId: string,
    aggregateVersion: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, causation_id, traceparent, aggregate_type,
        aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, $2::uuid, $3::uuid, $4, 'booking_hold', $5::uuid, $6, $7::jsonb, $8)
    `, [
      eventType,
      correlationId,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      aggregateId,
      aggregateVersion,
      JSON.stringify(payload),
      `${eventType}:${aggregateId}:${aggregateVersion}`,
    ]);
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') return DomainErrors.slotAlreadyTaken();
    }
    if (error instanceof Error && error.message === 'timeout exceeded when trying to connect') {
      return DomainErrors.slotLockedRetry();
    }
    this.logger.error('Unexpected booking hold creation error', error instanceof Error ? error.stack : undefined);
    return DomainErrors.bookingUnavailable();
  }
}
