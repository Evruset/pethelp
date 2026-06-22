import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainErrors, DomainException } from '../common/domain-error';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { BookingRepository } from './booking.repository';
import { CreateHoldResult, HoldRow, HoldState } from './booking.types';

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
}

interface PetOwnershipRow {
  owner_id: string;
  external_patient_id: string | null;
}

interface ClinicMisRow {
  clinic_id: string;
  mis_type: string | null;
}

@Injectable()
export class BookingHoldCreationService {
  private readonly logger = new Logger(BookingHoldCreationService.name);

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
  }): Promise<CreateHoldResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);

        // Global interactive lock order: pet, then slot.
        const pet = await client.query<PetOwnershipRow>(`
          SELECT owner_id, external_patient_id
          FROM pet_schema.pets
          WHERE id = $1
          FOR SHARE
        `, [input.petId]);
        if (!pet.rows[0] || pet.rows[0].owner_id !== input.ownerId) {
          throw DomainErrors.petOwnershipMismatch();
        }

        const idempotencyScope = `booking.create-local-hold:${input.ownerId}`;
        const existing = await this.acquireIdempotency(client, idempotencyScope, input.idempotencyKey);
        if (existing) return existing as unknown as CreateHoldResult;

        const slot = await this.repository.lockSlot(client, input.slotId);
        if (!slot) throw DomainErrors.slotNotFound();

        const now = await this.repository.now(client);
        if (
          slot.state !== 'OPEN' ||
          slot.starts_at <= now ||
          slot.capacity - slot.booked_count - slot.held_count <= 0
        ) {
          throw DomainErrors.slotAlreadyTaken();
        }

        const clinic = await client.query<ClinicMisRow>(`
          SELECT c.id AS clinic_id, c.mis_type
          FROM clinic_schema.clinic_locations l
          JOIN clinic_schema.clinics c ON c.id = l.clinic_id
          WHERE l.id = $1::uuid
        `, [slot.clinic_location_id]);
        if (!clinic.rows[0]) throw DomainErrors.slotNotFound();

        const requiresMisReservation = Boolean(clinic.rows[0].mis_type);
        if (requiresMisReservation && !pet.rows[0].external_patient_id) {
          throw new DomainException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'EXTERNAL_PATIENT_MAPPING_REQUIRED',
            'Pet is not mapped to an external MIS patient',
          );
        }

        const initialState: HoldState = requiresMisReservation
          ? 'MIS_RESERVATION_PENDING'
          : 'MANUAL_CONFIRM_PENDING';

        const hold = await client.query<HoldRow>(`
          INSERT INTO booking_schema.booking_holds (
            slot_id, owner_id, pet_id, state, expires_at
          )
          VALUES (
            $1, $2, $3, $4,
            clock_timestamp() + ($5::text || ' minutes')::interval
          )
          RETURNING
            id, slot_id, owner_id, pet_id, state,
            expires_at, state_changed_at, version, created_at
        `, [input.slotId, input.ownerId, input.petId, initialState, config.holdTtlMinutes]);

        await client.query(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count + 1,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1
        `, [input.slotId]);

        const result: CreateHoldResult = {
          holdId: hold.rows[0].id,
          state: initialState,
          slotId: input.slotId,
          expiresAt: hold.rows[0].expires_at.toISOString(),
          correlationId: input.correlationId,
        };

        await this.writeOutbox(client, 'booking.hold.created.v1', input.correlationId, hold.rows[0].id, hold.rows[0].version, {
          holdId: hold.rows[0].id,
          slotId: input.slotId,
          ownerId: input.ownerId,
          petId: input.petId,
          state: initialState,
          expiresAt: result.expiresAt,
        });

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
          JSON.stringify({ slotId: input.slotId, petId: input.petId, state: initialState }),
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

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async acquireIdempotency(
    client: PoolClient,
    scope: string,
    idempotencyKey: string,
  ): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING')
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, idempotencyKey]);

    if (inserted.rows[0]) return undefined;

    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_status, response_body
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, idempotencyKey]);

    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
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
        event_type, correlation_id, aggregate_type,
        aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, $2::uuid, 'booking_hold', $3::uuid, $4, $5::jsonb, $6)
    `, [
      eventType,
      correlationId,
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
    this.logger.error('Unexpected booking hold creation error', error instanceof Error ? error.stack : undefined);
    return DomainErrors.bookingUnavailable();
  }
}
