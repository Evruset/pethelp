import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors, DomainException, DomainRateLimitException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';
import { mvpScope } from '../config/mvp-scope.config';
import { PostgresRateLimitService } from '../platform/rate-limit/postgres-rate-limit.service';
import { canTransition } from './booking-state-machine';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPatientAssociationLifecycleService } from './clinic-patient-association-lifecycle.service';
import { ReallocationFinalizationService } from './reallocation-finalization.service';
import { ConfirmHoldResult, HoldRow, OwnerCancellationResult, ReleaseHoldResult, RequestCancellationResult, RequestNotesResult, SlotRow } from './booking.types';

interface LockedHoldAndSlot {
  hold_id: string;
  hold_owner_id: string;
  hold_pet_id: string;
  hold_state: HoldRow['state'];
  hold_expires_at: Date;
  hold_confirmation_sla_expires_at: Date | null;
  hold_state_changed_at: Date;
  hold_version: number;
  hold_created_at: Date;
  slot_id: string;
  clinic_id: string;
  clinic_location_id: string;
  slot_starts_at: Date;
  slot_ends_at: Date;
  slot_capacity: number;
  slot_booked_count: number;
  slot_held_count: number;
  slot_state: SlotRow['state'];
  slot_version: number;
}

interface ReleaseHoldRow {
  id: string;
  slot_id: string;
  owner_id: string;
  state: HoldRow['state'];
  expires_at: Date;
  confirmation_sla_expires_at: Date | null;
  alternative_slot_id: string | null;
  alternative_expires_at: Date | null;
  version: number;
}

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  request_fingerprint?: string | null;
}

interface DecisionFailureOutcome {
  kind: 'FAILURE';
  status: number;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

interface DecisionScope {
  clinic_id: string;
  clinic_location_id: string;
}

interface DeferredFingerprintConflict {
  __fingerprintConflict: true;
}

@Injectable()
export class BookingSecurityService {
  private readonly logger = new Logger(BookingSecurityService.name);
  private readonly traceContext = new TraceContext();

  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
    @Optional() private readonly patientAssociation?: ClinicPatientAssociationLifecycleService,
    @Optional() private readonly rateLimiter?: PostgresRateLimitService,
    private readonly reallocationFinalization?: ReallocationFinalizationService,
  ) {}

  async confirmManualHold(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number }): Promise<ConfirmHoldResult> {
    try {
      const outcome = await this.database.withTransaction(async (client): Promise<ConfirmHoldResult | DecisionFailureOutcome> => {
        await this.setInteractiveTransactionLimits(client);
        this.clinicAccess.assertBookingDecisionCapability(input.employee);
        const authority = await this.readDecisionScope(client, input.holdId);
        if (!authority) throw DomainErrors.holdNotFound();
        this.assertDecisionClaims(input.employee, authority);
        const scope = `booking.clinic-decision:${authority.clinic_id}`;
        const fingerprint = this.decisionFingerprint('CONFIRM', input.holdId, input.expectedVersion);
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint, true);
        await this.assertDecisionResourceAccess(client, input.employee, authority);
        if (replay && '__fingerprintConflict' in replay) throw this.decisionIdempotencyConflict();
        if (replay) return replay as unknown as ConfirmHoldResult;
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked || locked.clinic_id !== authority.clinic_id || locked.clinic_location_id !== authority.clinic_location_id) {
          throw DomainErrors.holdNotFound();
        }

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, this.decisionStateConflict());
        }
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          if (hold.state === 'MANUAL_CONFIRM_PENDING') {
            await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-confirm-sla-expired');
          }
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.holdExpired());
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-confirm-detected-expiry');
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.holdExpired());
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, error);
          }
        }
        if (!canTransition(hold.state, 'CONFIRMED')) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, this.decisionStateConflict());
        }

        const updatedHold = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'CONFIRMED',
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        const movedCapacity = await client.query<{ id: string }>(`
          UPDATE clinic_schema.appointment_slots
          SET held_count = held_count - 1,
              booked_count = booked_count + 1,
              status = CASE
                WHEN booked_count + 1 >= capacity THEN 'BOOKED'
                WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
                ELSE 'AVAILABLE'
              END,
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
            AND held_count > 0
            AND booked_count < capacity
          RETURNING id
        `, [slot.id]);
        if (!movedCapacity.rows[0]) throw DomainErrors.bookingUnavailable();
        const appointment = await client.query<{ id: string; version: number }>(`
          INSERT INTO booking_schema.appointments (hold_id, owner_id, pet_id, clinic_location_id, slot_id)
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)
          RETURNING id, version
        `, [hold.id, hold.owner_id, hold.pet_id, slot.clinic_location_id, slot.id]);
        const serverNow = await this.dbNow(client);
        const result: ConfirmHoldResult = {
          holdId: hold.id,
          appointmentId: appointment.rows[0].id,
          state: 'CONFIRMED',
          slotId: slot.id,
          correlationId: input.correlationId,
          aggregateVersion: updatedHold.rows[0].version,
          lastUpdatedAt: updatedHold.rows[0].state_changed_at.toISOString(),
          serverNow: serverNow.toISOString(),
        };

        const appointmentEvent = await client.query<{ id: string }>(`
          INSERT INTO booking_schema.appointment_events (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
          VALUES ($1::uuid, $2::uuid, 'CONFIRMED', 'CLINIC_EMPLOYEE', $3::uuid, $4::uuid, $5::jsonb)
          RETURNING id
        `, [result.appointmentId, hold.id, input.employee.sub, input.correlationId, JSON.stringify({ slotId: slot.id, clinicLocationId: slot.clinic_location_id })]);
        await this.writeOutbox(client, 'booking.confirmed.v1', input.correlationId, hold.id, updatedHold.rows[0].version, { ...result, employeeId: input.employee.sub, clinicLocationId: slot.clinic_location_id });
        if (this.patientAssociation) {
          const scope = await client.query<{ clinic_id: string; consent_id: string | null }>(`
            SELECT location.clinic_id::text,
                   consent.id::text AS consent_id
            FROM clinic_schema.clinic_locations location
            LEFT JOIN LATERAL (
              SELECT candidate.id
              FROM clinic_schema.clinic_patient_consents candidate
              WHERE candidate.clinic_id = location.clinic_id
                AND candidate.clinic_location_id = location.id
                AND candidate.pet_id = $2::uuid
                AND candidate.purpose = 'PATIENT_ADMIN_REGISTRY'
                AND candidate.granted_at <= clock_timestamp()
                AND (candidate.expires_at IS NULL OR candidate.expires_at > clock_timestamp())
                AND candidate.revoked_at IS NULL
              ORDER BY candidate.granted_at DESC, candidate.id DESC
              LIMIT 1
            ) consent ON true
            WHERE location.id = $1::uuid
          `, [slot.clinic_location_id, hold.pet_id]);
          const producerScope = scope.rows[0];
          if (producerScope?.consent_id) {
            await this.patientAssociation.applyQualifyingAppointmentEvidenceInTransaction(client, {
              sourceEventId: appointmentEvent.rows[0].id,
              sourceAppointmentId: appointment.rows[0].id,
              sourceAggregateVersion: appointment.rows[0].version,
              tenantId: producerScope.clinic_id,
              clinicId: producerScope.clinic_id,
              locationId: slot.clinic_location_id,
              petId: hold.pet_id,
              consentId: producerScope.consent_id,
              correlationId: input.correlationId,
            });
          }
        }
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.confirmed', hold.id, input.correlationId, { appointmentId: result.appointmentId, clinicLocationId: slot.clinic_location_id });
        await this.reallocationFinalization?.finalizeReplacement(client, hold.id, 'CONFIRMED', input.correlationId);
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
      if (this.isDecisionFailure(outcome)) throw new DomainException(outcome.status, outcome.code, outcome.message);
      return outcome;
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async declineManualHold(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number; declineReason?: string }): Promise<ReleaseHoldResult> {
    try {
      const outcome = await this.database.withTransaction(async (client): Promise<ReleaseHoldResult | DecisionFailureOutcome> => {
        await this.setInteractiveTransactionLimits(client);
        this.clinicAccess.assertBookingDecisionCapability(input.employee);
        const authority = await this.readDecisionScope(client, input.holdId);
        if (!authority) throw DomainErrors.holdNotFound();
        this.assertDecisionClaims(input.employee, authority);
        const scope = `booking.clinic-decision:${authority.clinic_id}`;
        const normalizedReason = input.declineReason?.trim() || null;
        const fingerprint = this.decisionFingerprint('DECLINE', input.holdId, input.expectedVersion, normalizedReason);
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint, true);
        await this.assertDecisionResourceAccess(client, input.employee, authority);
        if (replay && '__fingerprintConflict' in replay) throw this.decisionIdempotencyConflict();
        if (replay) return replay as unknown as ReleaseHoldResult;
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked || locked.clinic_id !== authority.clinic_id || locked.clinic_location_id !== authority.clinic_location_id) {
          throw DomainErrors.holdNotFound();
        }

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, this.decisionStateConflict());
        }
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          if (hold.state === 'MANUAL_CONFIRM_PENDING') {
            await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-decline-sla-expired');
          }
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.holdExpired());
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'manual-decline-detected-expiry');
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.holdExpired());
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, error);
          }
        }
        if (!canTransition(hold.state, 'RELEASED')) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, this.decisionStateConflict());
        }

        await this.releaseSlotCounter(client, slot.id);
        const updated = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED',
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        const reason = normalizedReason || 'OTHER';
        const serverNow = await this.dbNow(client);
        const result: ReleaseHoldResult = {
          holdId: hold.id,
          state: 'RELEASED',
          slotId: slot.id,
          correlationId: input.correlationId,
          aggregateVersion: updated.rows[0].version,
          lastUpdatedAt: updated.rows[0].state_changed_at.toISOString(),
          serverNow: serverNow.toISOString(),
        };

        await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, {
          ...result,
          reason: 'CLINIC_DECLINED',
          declineReason: reason,
          employeeId: input.employee.sub,
          clinicLocationId: slot.clinic_location_id,
        });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.declined', hold.id, input.correlationId, {
          slotId: slot.id,
          clinicLocationId: slot.clinic_location_id,
          reason,
        });
        await this.reallocationFinalization?.finalizeReplacement(client, hold.id, 'REJECTED', input.correlationId);
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
      if (this.isDecisionFailure(outcome)) throw new DomainException(outcome.status, outcome.code, outcome.message);
      return outcome;
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async requestOwnerNotes(input: { holdId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number; noteRequest: string }): Promise<RequestNotesResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const locked = await this.lockHoldAndSlot(client, input.holdId);
        if (!locked) throw DomainErrors.holdNotFound();

        await this.clinicAccess.assertLocationAccess(client, input.employee, locked.clinic_location_id);
        const scope = `booking.request-owner-notes:${input.employee.sub}`;
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
        if (replay) return replay as unknown as RequestNotesResult;

        const hold = this.toHold(locked);
        const slot = this.toSlot(locked);
        if (hold.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
        const now = await this.dbNow(client);
        if (hold.confirmation_sla_expires_at && hold.confirmation_sla_expires_at <= now) {
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.expireLockedHold(client, hold, slot, input.correlationId, 'request-notes-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (hold.state === 'MANUAL_CONFIRM_PENDING') {
          const earlierHoldId = await this.findEarlierActionableQueueHold(client, hold, slot.clinic_location_id, now);
          if (earlierHoldId) {
            const error = DomainErrors.queueFifoViolation();
            await this.completeIdempotency(client, scope, input.idempotencyKey, error.getResponse(), error.getStatus());
            throw error;
          }
        }
        if (hold.state !== 'MANUAL_CONFIRM_PENDING') throw DomainErrors.invalidTransition();

        const noteRequest = input.noteRequest.trim();
        const updated = await client.query<{ version: number }>(`
          UPDATE booking_schema.booking_holds
          SET version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING version
        `, [hold.id]);
        const result: RequestNotesResult = {
          holdId: hold.id,
          state: 'MANUAL_CONFIRM_PENDING',
          slotId: slot.id,
          version: updated.rows[0].version,
          requestedNote: noteRequest,
          correlationId: input.correlationId,
        };

        await this.writeOutbox(client, 'booking.notes.requested.v1', input.correlationId, hold.id, updated.rows[0].version, {
          ...result,
          employeeId: input.employee.sub,
          ownerId: hold.owner_id,
          petId: hold.pet_id,
          clinicLocationId: slot.clinic_location_id,
        });
        await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'booking.notes.requested', hold.id, input.correlationId, {
          slotId: slot.id,
          clinicLocationId: slot.clinic_location_id,
          noteRequest,
        });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async cancelOwnerBooking(input: {
    holdId: string;
    owner: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    reasonCode?: 'OWNER_PLANS_CHANGED' | 'PET_RECOVERED' | 'OTHER';
  }): Promise<OwnerCancellationResult | ReleaseHoldResult | RequestCancellationResult> {
    if (!mvpScope.pilot) {
      return this.releaseHold({
        holdId: input.holdId,
        actor: input.owner,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        expectedVersion: input.expectedVersion,
        reasonCode: input.reasonCode,
        normalizeOwnerNotFound: true,
      });
    }

    try {
      const outcome = await this.database.withTransaction(async (client): Promise<OwnerCancellationResult | DecisionFailureOutcome> => {
        await this.setInteractiveTransactionLimits(client);
        if (!input.owner.roles.includes(Role.OWNER)) throw DomainErrors.holdNotFound();

        const authority = await client.query<{ owner_id: string }>(`
          SELECT owner_id::text
          FROM booking_schema.booking_holds
          WHERE id = $1::uuid
        `, [input.holdId]);
        if (!authority.rows[0] || authority.rows[0].owner_id !== input.owner.sub) throw DomainErrors.holdNotFound();

        const scope = `booking.owner-cancel:${authority.rows[0].owner_id}`;
        await this.cleanupCompletedOwnerCancellationLedger(client, scope);
        const reasonCode = input.reasonCode ?? null;
        const fingerprint = createHash('sha256').update(JSON.stringify({
          operation: 'OWNER_CANCEL',
          holdId: input.holdId,
          expectedVersion: input.expectedVersion,
          payload: { reasonCode },
        })).digest('hex');
        // Same-key contenders may wait for the fenced winner to persist its durable
        // outcome; restore the short business-lock budget before touching the hold.
        await client.query("SET LOCAL lock_timeout = '2s'");
        await client.query("SET LOCAL statement_timeout = '3s'");
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint, true);
        // A successful fence acquisition must not broaden later business-lock budgets.
        // On acquisition error the transaction ends, so SET LOCAL is reset by rollback.
        await client.query("SET LOCAL lock_timeout = '50ms'");
        await client.query("SET LOCAL statement_timeout = '250ms'");
        if (replay && '__fingerprintConflict' in replay) throw this.decisionIdempotencyConflict();
        if (replay) return replay as unknown as OwnerCancellationResult;
        // Only the transaction that inserted the PROCESSING fence consumes quota.
        // Same-key contenders block on the unique key and replay its durable outcome.
        try {
          await this.enforceOwnerCancellationRateLimit(input.owner.sub);
        } catch (error) {
          if (error instanceof DomainRateLimitException) {
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, error);
          }
          throw error;
        }
        // Canonical mutation order: idempotency record, hold, then all slots.
        const hold = await this.lockReleaseHold(client, input.holdId);
        if (!hold || hold.owner_id !== authority.rows[0].owner_id) throw DomainErrors.holdNotFound();
        if (hold.version !== input.expectedVersion) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.bookingStateConflict());
        }
        if (!['MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'CONFIRMED'].includes(hold.state)) {
          return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.bookingStateConflict());
        }

        const slotIds = [...new Set([hold.slot_id, hold.alternative_slot_id].filter(Boolean) as string[])].sort();
        const slots = await client.query<{ id: string; held_count: number; booked_count: number; capacity: number }>(`
          SELECT id, held_count, booked_count, capacity
          FROM clinic_schema.appointment_slots
          WHERE id = ANY($1::uuid[])
          ORDER BY id
          FOR UPDATE
        `, [slotIds]);
        if (slots.rows.length !== slotIds.length) throw DomainErrors.bookingUnavailable();

        const now = await this.dbNow(client);
        if (hold.state === 'MANUAL_CONFIRM_PENDING' || hold.state === 'ALTERNATIVE_PENDING') {
          const deadlineElapsed = hold.expires_at <= now
            || (hold.confirmation_sla_expires_at !== null && hold.confirmation_sla_expires_at <= now)
            || (hold.alternative_expires_at !== null && hold.alternative_expires_at <= now);
          if (deadlineElapsed) {
            for (const slotId of slotIds) await this.releaseSlotCounter(client, slotId);
            await this.markHoldExpired(client, hold, input.correlationId, 'owner-cancel-detected-expiry');
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.bookingStateConflict());
          }
        }

        let appointmentId: string | undefined;
        if (hold.state === 'CONFIRMED') {
          const appointment = await client.query<{ id: string; status: string }>(`
            SELECT id, status
            FROM booking_schema.appointments
            WHERE hold_id = $1::uuid
            FOR UPDATE
          `, [hold.id]);
          if (!appointment.rows[0]) throw DomainErrors.bookingUnavailable();
          if (appointment.rows[0].status !== 'CONFIRMED') {
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.bookingStateConflict());
          }
          appointmentId = appointment.rows[0].id;
          const cancelled = await client.query<{ id: string }>(`
            UPDATE booking_schema.appointments
            SET status = 'CANCELLED', version = version + 1, updated_at = clock_timestamp()
            WHERE id = $1::uuid AND status = 'CONFIRMED'
            RETURNING id
          `, [appointmentId]);
          if (!cancelled.rows[0]) {
            return this.completeDecisionFailure(client, scope, input.idempotencyKey, DomainErrors.bookingStateConflict());
          }
          const released = await client.query<{ id: string }>(`
            UPDATE clinic_schema.appointment_slots
            SET booked_count = booked_count - 1,
                status = CASE
                  WHEN booked_count - 1 >= capacity THEN 'BOOKED'
                  WHEN held_count > 0 THEN 'LOCKED_BY_HOLD'
                  ELSE 'AVAILABLE'
                END,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE id = $1::uuid AND booked_count > 0
            RETURNING id
          `, [hold.slot_id]);
          if (!released.rows[0]) throw DomainErrors.bookingUnavailable();
        } else {
          for (const slotId of slotIds) await this.releaseSlotCounter(client, slotId);
          if (hold.alternative_slot_id) await this.finalizePendingAlternativeSwapGroup(client, hold.id, 'DECLINED');
        }

        const updated = await client.query<{ version: number; state_changed_at: Date }>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED',
              alternative_slot_id = NULL,
              alternative_expires_at = NULL,
              confirmation_sla_expires_at = NULL,
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING version, state_changed_at
        `, [hold.id]);
        const serverNow = await this.dbNow(client);
        const result: OwnerCancellationResult = {
          holdId: hold.id,
          state: 'RELEASED',
          slotId: hold.slot_id,
          correlationId: input.correlationId,
          aggregateVersion: updated.rows[0].version,
          lastUpdatedAt: updated.rows[0].state_changed_at.toISOString(),
          serverNow: serverNow.toISOString(),
          ...(appointmentId ? { appointmentId } : {}),
        };

        if (appointmentId) {
          await client.query(`
            INSERT INTO booking_schema.appointment_events
              (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
            VALUES ($1::uuid, $2::uuid, 'CANCELLED', 'OWNER', $3::uuid, $4::uuid, $5::jsonb)
          `, [appointmentId, hold.id, input.owner.sub, input.correlationId, JSON.stringify({ reasonCode })]);
        }
        await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, {
          ...result,
          reason: 'OWNER_CANCELLED',
          actorId: input.owner.sub,
          reasonCode,
        });
        await this.writeAudit(client, 'OWNER', input.owner.sub, 'booking.hold.released', hold.id, input.correlationId, {
          slotId: hold.slot_id,
          ...(appointmentId ? { appointmentId } : {}),
          reason: 'OWNER_CANCELLED',
          reasonCode,
        });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
      if (this.isDecisionFailure(outcome)) {
        if (outcome.code === 'RATE_LIMITED') {
          throw DomainErrors.ownerCancellationRateLimited(outcome.retryAfterSeconds ?? 1);
        }
        throw new DomainException(outcome.status, outcome.code, outcome.message);
      }
      return outcome;
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  async releaseHold(input: { holdId: string; actor: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion?: number; reasonCode?: string; normalizeOwnerNotFound?: boolean }): Promise<ReleaseHoldResult | RequestCancellationResult> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.setInteractiveTransactionLimits(client);
        const hold = await this.lockReleaseHold(client, input.holdId);
        if (!hold) throw DomainErrors.holdNotFound();

        const systemWorker = input.actor.roles.includes(Role.SYSTEM_WORKER);
        if (!systemWorker && hold.owner_id !== input.actor.sub) {
          if (input.normalizeOwnerNotFound) throw DomainErrors.holdNotFound();
          throw DomainErrors.holdOwnerMismatch();
        }
        const scope = `booking.owner-cancel:${input.actor.sub}:${hold.id}`;
        const fingerprint = createHash('sha256').update(JSON.stringify({ expectedVersion: input.expectedVersion ?? null, holdId: hold.id, reasonCode: input.reasonCode ?? null })).digest('hex');
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint);
        if (replay) return replay as unknown as ReleaseHoldResult;

        if (input.expectedVersion !== undefined && hold.version !== input.expectedVersion) {
          throw DomainErrors.bookingVersionStale();
        }

        const pilotConfirmedCancellation = mvpScope.pilot && hold.state === 'CONFIRMED';
        const externallyCancelled = ['CONFIRMED', 'MIS_HELD', 'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING'].includes(hold.state);
        const locallyReleasable = ['MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING'].includes(hold.state);
        if (!externallyCancelled && !locallyReleasable) {
          throw DomainErrors.invalidTransition();
        }

        // Legacy confirmed or externally-held bookings remain capacity-accounted
        // until the clinic/external workflow confirms cancellation.
        if (externallyCancelled && !pilotConfirmedCancellation) {
          const updated = await client.query<{ version: number }>(`
            UPDATE booking_schema.booking_holds
            SET state = 'CANCELLATION_REQUESTED', state_changed_at = clock_timestamp(),
                version = version + 1, updated_at = clock_timestamp()
            WHERE id = $1::uuid
            RETURNING version
          `, [hold.id]);
          const result: RequestCancellationResult = { holdId: hold.id, state: 'CANCELLATION_REQUESTED', slotId: hold.slot_id, correlationId: input.correlationId };
          await this.writeOutbox(client, 'booking.cancellation.requested.v1', input.correlationId, hold.id, updated.rows[0].version, { ...result, reasonCode: input.reasonCode ?? null });
          await this.writeAudit(client, 'OWNER', input.actor.sub, 'booking.cancellation_requested', hold.id, input.correlationId, { slotId: hold.slot_id, reasonCode: input.reasonCode ?? null });
          await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
          return result;
        }

        if (pilotConfirmedCancellation) {
          if (!canTransition('CONFIRMED', 'CANCELLATION_REQUESTED') || !canTransition('CANCELLATION_REQUESTED', 'RELEASED')) {
            throw DomainErrors.invalidTransition();
          }
          const appointment = await client.query<{ id: string; version: number }>(`
            UPDATE booking_schema.appointments
            SET status = 'CANCELLED', version = version + 1, updated_at = clock_timestamp()
            WHERE hold_id = $1::uuid AND status NOT IN ('CANCELLED', 'CLINIC_CANCELLED')
            RETURNING id, version
          `, [hold.id]);
          if (!appointment.rows[0]) throw DomainErrors.invalidTransition();

          const released = await client.query<{ id: string }>(`
            UPDATE clinic_schema.appointment_slots
            SET booked_count = booked_count - 1,
                status = CASE
                  WHEN booked_count - 1 >= capacity THEN 'BOOKED'
                  WHEN held_count > 0 THEN 'LOCKED_BY_HOLD'
                  ELSE 'AVAILABLE'
                END,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE id = $1::uuid AND booked_count > 0
            RETURNING id
          `, [hold.slot_id]);
          if (!released.rows[0]) throw DomainErrors.bookingUnavailable();

          const updated = await client.query<{ version: number }>(`
            UPDATE booking_schema.booking_holds
            SET state = 'RELEASED', confirmation_sla_expires_at = NULL,
                state_changed_at = clock_timestamp(), version = version + 1,
                updated_at = clock_timestamp()
            WHERE id = $1::uuid
            RETURNING version
          `, [hold.id]);
          const result: ReleaseHoldResult = { holdId: hold.id, state: 'RELEASED', slotId: hold.slot_id, correlationId: input.correlationId };
          await client.query(`
            INSERT INTO booking_schema.appointment_events
              (appointment_id, hold_id, event_type, actor_type, actor_id, correlation_id, payload_json)
            VALUES ($1::uuid, $2::uuid, 'CANCELLED', 'OWNER', $3::uuid, $4::uuid, $5::jsonb)
          `, [appointment.rows[0].id, hold.id, input.actor.sub, input.correlationId, JSON.stringify({ reasonCode: input.reasonCode ?? null })]);
          await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, {
            ...result, appointmentId: appointment.rows[0].id, reason: 'OWNER_CANCELLED', actorId: input.actor.sub,
          });
          await this.writeAudit(client, 'OWNER', input.actor.sub, 'booking.hold.released', hold.id, input.correlationId, {
            appointmentId: appointment.rows[0].id, slotId: hold.slot_id, reason: 'OWNER_CANCELLED', reasonCode: input.reasonCode ?? null,
          });
          await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
          return result;
        }

        const slotIds = [...new Set([hold.slot_id, hold.alternative_slot_id].filter(Boolean) as string[])].sort();
        const slots = await client.query<{ id: string; held_count: number; booked_count: number; capacity: number }>(`
          SELECT id, held_count, booked_count, capacity
          FROM clinic_schema.appointment_slots
          WHERE id = ANY($1::uuid[])
          ORDER BY id
          FOR UPDATE
        `, [slotIds]);
        if (slots.rows.length !== slotIds.length) throw DomainErrors.slotNotFound();

        const now = await this.dbNow(client);
        if (hold.state === 'MANUAL_CONFIRM_PENDING' && hold.expires_at <= now) {
          await this.releaseSlotCounter(client, hold.slot_id);
          await this.markHoldExpired(client, hold, input.correlationId, 'release-detected-expiry');
          await this.completeIdempotency(client, scope, input.idempotencyKey, DomainErrors.holdExpired().getResponse(), DomainErrors.holdExpired().getStatus());
          throw DomainErrors.holdExpired();
        }
        if (!canTransition(hold.state, 'RELEASED')) throw DomainErrors.invalidTransition();

        await this.releaseSlotCounter(client, hold.slot_id);
        if (hold.alternative_slot_id) await this.releaseSlotCounter(client, hold.alternative_slot_id);
        const declinedSwapGroupId = hold.alternative_slot_id ? await this.finalizePendingAlternativeSwapGroup(client, hold.id, 'DECLINED') : null;

        const updated = await client.query<HoldRow>(`
          UPDATE booking_schema.booking_holds
          SET state = 'RELEASED',
              alternative_slot_id = NULL,
              alternative_expires_at = NULL,
              confirmation_sla_expires_at = NULL,
              state_changed_at = clock_timestamp(),
              version = version + 1,
              updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING id, slot_id, owner_id, pet_id, state, expires_at, state_changed_at, version, created_at
        `, [hold.id]);
        const result: ReleaseHoldResult = { holdId: hold.id, state: 'RELEASED', slotId: hold.slot_id, correlationId: input.correlationId, swapGroupId: declinedSwapGroupId };
        await this.writeOutbox(client, 'booking.hold.released.v1', input.correlationId, hold.id, updated.rows[0].version, { ...result, swapGroupId: declinedSwapGroupId, reason: systemWorker ? 'SYSTEM_RELEASE' : 'OWNER_CANCELLED', actorId: input.actor.sub });
        await this.writeAudit(client, systemWorker ? 'SYSTEM_WORKER' : 'OWNER', input.actor.sub, 'booking.hold.released', hold.id, input.correlationId, { swapGroupId: declinedSwapGroupId, slotId: hold.slot_id, alternativeSlotId: hold.alternative_slot_id, reason: systemWorker ? 'SYSTEM_RELEASE' : 'OWNER_CANCELLED' });
        await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
        return result;
      });
    } catch (error) {
      throw this.mapPgError(error);
    }
  }

  private async lockHoldAndSlot(client: PoolClient, holdId: string): Promise<LockedHoldAndSlot | undefined> {
    const hold = await client.query<Pick<LockedHoldAndSlot,
      'hold_id' | 'hold_owner_id' | 'hold_pet_id' | 'hold_state' | 'hold_expires_at'
      | 'hold_confirmation_sla_expires_at' | 'hold_state_changed_at' | 'hold_version' | 'hold_created_at'
      | 'slot_id'>>(`
      SELECT h.id AS hold_id, h.owner_id AS hold_owner_id, h.pet_id AS hold_pet_id, h.state AS hold_state,
             h.expires_at AS hold_expires_at, h.confirmation_sla_expires_at AS hold_confirmation_sla_expires_at,
             h.state_changed_at AS hold_state_changed_at, h.version AS hold_version, h.created_at AS hold_created_at,
             h.slot_id
      FROM booking_schema.booking_holds h
      WHERE h.id = $1::uuid
      FOR UPDATE OF h
    `, [holdId]);
    if (!hold.rows[0]) return undefined;

    const slot = await client.query<Pick<LockedHoldAndSlot,
      'slot_id' | 'clinic_id' | 'clinic_location_id' | 'slot_starts_at' | 'slot_ends_at'
      | 'slot_capacity' | 'slot_booked_count' | 'slot_held_count' | 'slot_state' | 'slot_version'>>(`
      SELECT s.id AS slot_id, location.clinic_id::text AS clinic_id, s.clinic_location_id,
             s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at,
             s.capacity AS slot_capacity, s.booked_count AS slot_booked_count, s.held_count AS slot_held_count,
             s.state AS slot_state, s.version AS slot_version
      FROM clinic_schema.appointment_slots s
      JOIN clinic_schema.clinic_locations location ON location.id = s.clinic_location_id
      WHERE s.id = $1::uuid
      FOR UPDATE OF s
    `, [hold.rows[0].slot_id]);
    if (!slot.rows[0]) return undefined;
    return { ...hold.rows[0], ...slot.rows[0] } as LockedHoldAndSlot;
  }

  private async readDecisionScope(client: PoolClient, holdId: string): Promise<DecisionScope | undefined> {
    const result = await client.query<DecisionScope>(`
      SELECT location.clinic_id::text, slot.clinic_location_id::text
      FROM booking_schema.booking_holds hold
      JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      WHERE hold.id = $1::uuid
    `, [holdId]);
    return result.rows[0];
  }

  private async lockReleaseHold(client: PoolClient, holdId: string): Promise<ReleaseHoldRow | undefined> {
    const result = await client.query<ReleaseHoldRow>(`
      SELECT id, slot_id, owner_id, state, expires_at, confirmation_sla_expires_at,
             alternative_slot_id, alternative_expires_at, version
      FROM booking_schema.booking_holds
      WHERE id = $1::uuid
      FOR UPDATE
    `, [holdId]);
    return result.rows[0];
  }

  private async findEarlierActionableQueueHold(
    client: PoolClient,
    hold: HoldRow,
    clinicLocationId: string,
    now: Date,
  ): Promise<string | undefined> {
    const result = await client.query<{ id: string }>(`
      SELECT h.id
      FROM booking_schema.booking_holds h
      JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
      WHERE s.clinic_location_id = $1::uuid
        AND h.state = 'MANUAL_CONFIRM_PENDING'
        AND h.confirmation_sla_expires_at > $2::timestamptz
        AND h.expires_at > $2::timestamptz
        AND (
          h.state_changed_at < $3::timestamptz
          OR (h.state_changed_at = $3::timestamptz AND h.id < $4::uuid)
        )
      ORDER BY h.state_changed_at ASC, h.id ASC
      LIMIT 1
    `, [clinicLocationId, now.toISOString(), hold.state_changed_at.toISOString(), hold.id]);
    return result.rows[0]?.id;
  }

  private toHold(row: LockedHoldAndSlot): HoldRow {
    return {
      id: row.hold_id,
      slot_id: row.slot_id,
      owner_id: row.hold_owner_id,
      pet_id: row.hold_pet_id,
      state: row.hold_state,
      expires_at: row.hold_expires_at,
      confirmation_sla_expires_at: row.hold_confirmation_sla_expires_at,
      state_changed_at: row.hold_state_changed_at,
      version: row.hold_version,
      created_at: row.hold_created_at,
    };
  }

  private toSlot(row: LockedHoldAndSlot): SlotRow {
    return { id: row.slot_id, clinic_location_id: row.clinic_location_id, starts_at: row.slot_starts_at, ends_at: row.slot_ends_at, capacity: row.slot_capacity, booked_count: row.slot_booked_count, held_count: row.slot_held_count, state: row.slot_state, version: row.slot_version };
  }

  private async releaseSlotCounter(client: PoolClient, slotId: string): Promise<void> {
    const released = await client.query<{ id: string }>(`
      UPDATE clinic_schema.appointment_slots
      SET held_count = held_count - 1,
          status = CASE
            WHEN booked_count >= capacity THEN 'BOOKED'
            WHEN held_count - 1 > 0 THEN 'LOCKED_BY_HOLD'
            ELSE 'AVAILABLE'
          END,
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE id = $1::uuid AND held_count > 0
      RETURNING id
    `, [slotId]);
    if (!released.rows[0]) throw DomainErrors.bookingUnavailable();
  }

  private async markHoldExpired(client: PoolClient, hold: ReleaseHoldRow, correlationId: string, reason: string): Promise<void> {
    const expiredSwapGroupId = hold.alternative_slot_id ? await this.finalizePendingAlternativeSwapGroup(client, hold.id, 'EXPIRED') : null;
    const updated = await client.query<{ version: number }>(`
      UPDATE booking_schema.booking_holds
      SET state = 'EXPIRED', state_changed_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1::uuid
      RETURNING version
    `, [hold.id]);
    await this.writeOutbox(client, 'booking.hold.expired.v1', correlationId, hold.id, updated.rows[0].version, { holdId: hold.id, slotId: hold.slot_id, swapGroupId: expiredSwapGroupId, reason });
    await this.writeAudit(client, 'SYSTEM', null, 'booking.hold.expired', hold.id, correlationId, { slotId: hold.slot_id, swapGroupId: expiredSwapGroupId, reason });
  }

  private async finalizePendingAlternativeSwapGroup(client: PoolClient, holdId: string, state: 'DECLINED' | 'EXPIRED'): Promise<string | null> {
    const updated = await client.query<{ id: string }>(`
      UPDATE booking_schema.alternative_swap_groups
      SET state = $2,
          aggregate_version = aggregate_version + 1,
          updated_at = clock_timestamp()
      WHERE original_hold_id = $1::uuid
        AND state = 'PENDING'
      RETURNING id
    `, [holdId, state]);
    return updated.rows[0]?.id ?? null;
  }

  private async expireLockedHold(client: PoolClient, hold: HoldRow, slot: SlotRow, correlationId: string, reason: string): Promise<void> {
    await this.releaseSlotCounter(client, slot.id);
    await this.markHoldExpired(client, {
      id: hold.id,
      slot_id: hold.slot_id,
      owner_id: hold.owner_id,
      state: hold.state,
      expires_at: hold.expires_at,
      confirmation_sla_expires_at: hold.confirmation_sla_expires_at ?? null,
      alternative_slot_id: null,
      alternative_expires_at: null,
      version: hold.version,
    }, correlationId, reason);
    await this.reallocationFinalization?.finalizeReplacement(client, hold.id, 'EXPIRED', correlationId);
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private decisionFingerprint(operation: 'CONFIRM' | 'DECLINE', holdId: string, expectedVersion: number, declineReason: string | null = null): string {
    return createHash('sha256').update(JSON.stringify({ operation, holdId, expectedVersion, declineReason })).digest('hex');
  }

  private isDecisionFailure(outcome: ConfirmHoldResult | ReleaseHoldResult | DecisionFailureOutcome): outcome is DecisionFailureOutcome {
    return 'kind' in outcome && outcome.kind === 'FAILURE';
  }

  private assertDecisionClaims(employee: JwtPayload, authority: DecisionScope): void {
    if (!employee.clinicIds?.includes(authority.clinic_id) || !employee.locationIds?.includes(authority.clinic_location_id)) {
      throw DomainErrors.holdNotFound();
    }
  }

  private async assertDecisionResourceAccess(client: PoolClient, employee: JwtPayload, authority: DecisionScope): Promise<void> {
    try {
      await this.clinicAccess.assertBookingDecisionAccess(client, employee, authority.clinic_id, authority.clinic_location_id);
    } catch (error) {
      if (error instanceof DomainException && (error.getResponse() as { code?: string }).code === 'CLINIC_SCOPE_MISMATCH') {
        throw DomainErrors.holdNotFound();
      }
      throw error;
    }
  }

  private decisionStateConflict(): DomainException {
    return mvpScope.pilot ? DomainErrors.bookingStateConflict() : DomainErrors.slotVersionStale();
  }

  private decisionIdempotencyConflict(): DomainException {
    return mvpScope.pilot ? DomainErrors.idempotencyConflict() : DomainErrors.idempotencyPayloadConflict();
  }

  private async completeDecisionFailure(
    client: PoolClient,
    scope: string,
    key: string,
    error: DomainException,
  ): Promise<DecisionFailureOutcome> {
    const response = error.getResponse() as { code?: string; message?: string };
    const outcome: DecisionFailureOutcome = {
      kind: 'FAILURE',
      status: error.getStatus(),
      code: response.code ?? 'BOOKING_STATE_CONFLICT',
      message: response.message ?? 'Booking decision failed',
      ...(error instanceof DomainRateLimitException ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    };
    await this.completeIdempotency(client, scope, key, {
      code: outcome.code,
      message: outcome.message,
      ...(outcome.retryAfterSeconds ? { retryAfterSeconds: outcome.retryAfterSeconds } : {}),
    }, outcome.status);
    return outcome;
  }

  private async acquireIdempotency(
    client: PoolClient,
    scope: string,
    key: string,
    requestFingerprint?: string,
    deferFingerprintConflict = false,
  ): Promise<Record<string, unknown> | DeferredFingerprintConflict | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status, request_fingerprint)
      VALUES ($1, $2::uuid, 'PROCESSING', $3) ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key, requestFingerprint ?? null]);
    if (inserted.rows[0]) return undefined;
    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_status, response_body, request_fingerprint FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid FOR UPDATE
    `, [scope, key]);
    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
    if (requestFingerprint && existing.rows[0].request_fingerprint && existing.rows[0].request_fingerprint !== requestFingerprint) {
      if (deferFingerprintConflict) return { __fingerprintConflict: true };
      throw mvpScope.pilot ? DomainErrors.idempotencyConflict() : DomainErrors.idempotencyPayloadConflict();
    }
    if (existing.rows[0].status !== 'COMPLETED' || !existing.rows[0].response_body) throw DomainErrors.idempotencyInProgress();
    if ((existing.rows[0].response_status ?? 200) >= 400) {
      const body = existing.rows[0].response_body as { code?: string; message?: string; retryAfterSeconds?: number };
      if (body.code === 'RATE_LIMITED') {
        throw DomainErrors.ownerCancellationRateLimited(body.retryAfterSeconds ?? 1);
      }
      throw new DomainException(existing.rows[0].response_status ?? 409, body.code ?? 'IDEMPOTENT_REQUEST_FAILED', body.message ?? 'Previous request failed');
    }
    return existing.rows[0].response_body;
  }

  private async completeIdempotency(client: PoolClient, scope: string, key: string, body: unknown, status: number): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = $3, response_body = $4::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, key, status, JSON.stringify(body)]);
  }

  private async cleanupCompletedOwnerCancellationLedger(client: PoolClient, scope: string): Promise<void> {
    // Successful and deterministic-error replays are authoritative for 24 hours.
    // Cleanup is owner-scope-local, bounded and replica-safe; PROCESSING rows are never candidates.
    // Exact scope equality keeps access on the existing (scope, idempotency_key) index
    // and cannot touch legacy or another Owner's namespaces.
    const candidates = await client.query<{ idempotency_key: string }>(`
      SELECT idempotency_key::text
      FROM booking_schema.idempotency_records
      WHERE scope = $1
        AND status = 'COMPLETED'
        AND updated_at < clock_timestamp() - interval '24 hours'
      ORDER BY idempotency_key
      FOR UPDATE SKIP LOCKED
      LIMIT 25
    `, [scope]);
    for (const candidate of candidates.rows) {
      // Exact equality on both unique-index columns prevents a delete probe from
      // crossing into legacy or another Owner's scope.
      await client.query(`
        DELETE FROM booking_schema.idempotency_records
        WHERE scope = $1
          AND idempotency_key = $2::uuid
          AND status = 'COMPLETED'
          AND updated_at < clock_timestamp() - interval '24 hours'
      `, [scope, candidate.idempotency_key]);
    }
  }

  private async enforceOwnerCancellationRateLimit(ownerId: string): Promise<void> {
    if (!this.rateLimiter) throw DomainErrors.bookingUnavailable();
    try {
      const result = await this.rateLimiter.consume({
        namespace: 'owner-booking-cancel',
        actorId: ownerId,
        clinicId: '00000000-0000-4000-8000-000000000001',
        locationId: '00000000-0000-4000-8000-000000000002',
        policies: [{ windowSeconds: 60, limit: 60 }, { windowSeconds: 3_600, limit: 600 }],
        logicalStateRetentionSeconds: 3_900,
      });
      if (!result.allowed) throw DomainErrors.ownerCancellationRateLimited(result.retryAfterSeconds ?? 1);
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw DomainErrors.bookingUnavailable();
    }
  }

  private async writeOutbox(client: PoolClient, eventType: string, correlationId: string, aggregateId: string, aggregateVersion: number, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, causation_id, traceparent,
        aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key
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

  private async writeAudit(client: PoolClient, actorType: string, actorId: string | null, action: string, holdId: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ($1, $2, $3, 'booking_hold', $4::uuid, $5::uuid, $6::jsonb)
    `, [actorType, actorId, action, holdId, correlationId, JSON.stringify(payload)]);
  }

  private mapPgError(error: unknown): unknown {
    if (error instanceof DomainException) return error;
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const pgCode = String((error as { code?: unknown }).code);
      if (pgCode === '55P03' || pgCode === '57014') return DomainErrors.slotLockedRetry();
      if (pgCode === '23505') return DomainErrors.slotAlreadyTaken();
    }
    this.logger.error('Unexpected booking security error', error instanceof Error ? error.stack : undefined);
    return DomainErrors.bookingUnavailable();
  }
}
