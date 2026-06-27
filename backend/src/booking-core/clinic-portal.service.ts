import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors, DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';
import { CompleteAppointmentResult } from './booking.types';

export interface ManualConfirmationSlaResult {
  holdId: string;
  confirmationSlaExpiresAt: string;
}

interface LockedManualHold {
  id: string;
  state: string;
  integration_mode: 'LEVEL_A' | 'LEVEL_B' | 'LEVEL_C';
}

/**
 * Owns Level-C manual-confirmation SLA metadata. All eligibility and deadline
 * decisions use PostgreSQL clock_timestamp(), never application-node time.
 */
@Injectable()
export class ClinicPortalService {
  private readonly traceContext = new TraceContext();

  constructor(private readonly database: DatabaseService) {}

  async initiateManualConfirmationSla(holdId: string): Promise<ManualConfirmationSlaResult> {
    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const locked = await client.query<LockedManualHold>(`
        SELECT h.id, h.state, s.integration_mode
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        WHERE h.id = $1::uuid
        FOR UPDATE OF h, s
      `, [holdId]);
      const hold = locked.rows[0];
      if (!hold) throw DomainErrors.holdNotFound();
      if (hold.state !== 'MANUAL_CONFIRM_PENDING' || hold.integration_mode !== 'LEVEL_C') {
        throw DomainErrors.invalidTransition();
      }

      return this.initiateManualConfirmationSlaInTransaction(client, holdId);
    });
  }

  /**
   * Used when the hold has already been created inside the caller's short
   * transaction. The caller must own the hold row lock or have just inserted it.
   */
  async initiateManualConfirmationSlaInTransaction(
    client: PoolClient,
    holdId: string,
  ): Promise<ManualConfirmationSlaResult> {
    const result = await client.query<{ id: string; confirmation_sla_expires_at: Date }>(`
      UPDATE booking_schema.booking_holds
      SET confirmation_sla_expires_at = clock_timestamp() + interval '15 minutes',
          updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND state = 'MANUAL_CONFIRM_PENDING'
      RETURNING id, confirmation_sla_expires_at
    `, [holdId]);

    if (!result.rows[0]) throw DomainErrors.invalidTransition();
    return {
      holdId: result.rows[0].id,
      confirmationSlaExpiresAt: result.rows[0].confirmation_sla_expires_at.toISOString(),
    };
  }

  async completeAppointment(input: {
    holdId: string;
    summary: string;
    employee: JwtPayload;
    correlationId: string;
  }): Promise<CompleteAppointmentResult> {
    const clinicalSummary = input.summary.trim();
    if (clinicalSummary.length < 3 || clinicalSummary.length > 8000) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'INVALID_CLINICAL_SUMMARY', 'Clinical summary must be between 3 and 8000 characters');
    }

    return this.database.withTransaction(async (client) => {
      await this.setShortTransactionLimits(client);
      const locked = await client.query<{
        id: string;
        slot_id: string;
        owner_id: string;
        pet_id: string;
        state: string;
        version: number;
        clinic_location_id: string;
        clinical_summary: string | null;
      }>(`
        SELECT
          h.id, h.slot_id, h.owner_id, h.pet_id, h.state, h.version,
          h.clinical_summary, s.clinic_location_id
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        WHERE h.id = $1::uuid
        FOR UPDATE OF h, s
      `, [input.holdId]);
      const hold = locked.rows[0];
      if (!hold) throw DomainErrors.holdNotFound();
      this.assertCompletionAccess(input.employee, hold.clinic_location_id);

      if (hold.state === 'COMPLETED') {
        return {
          holdId: hold.id,
          state: 'COMPLETED',
          slotId: hold.slot_id,
          correlationId: input.correlationId,
          clinicalSummary: hold.clinical_summary ?? clinicalSummary,
        };
      }
      if (hold.state !== 'CONFIRMED') throw DomainErrors.invalidTransition();

      const updated = await client.query<{ version: number }>(`
        UPDATE booking_schema.booking_holds
        SET state = 'COMPLETED',
            clinical_summary = $2,
            state_changed_at = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING version
      `, [hold.id, clinicalSummary]);
      await client.query(`
        UPDATE booking_schema.appointments
        SET status = 'COMPLETED',
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE hold_id = $1::uuid
      `, [hold.id]);

      await this.writeOutbox(
        client,
        'notification.push.summary_ready.v1',
        input.correlationId,
        hold.id,
        updated.rows[0].version,
        {
          holdId: hold.id,
          slotId: hold.slot_id,
          ownerId: hold.owner_id,
          petId: hold.pet_id,
          clinicLocationId: hold.clinic_location_id,
        },
      );
      await client.query(`
        INSERT INTO audit_schema.audit_log (
          actor_type, actor_id, action, aggregate_type,
          aggregate_id, correlation_id, payload_json
        ) VALUES ('CLINIC_EMPLOYEE', $1, 'booking.appointment.completed', 'booking_hold', $2::uuid, $3::uuid, $4::jsonb)
      `, [
        input.employee.sub,
        hold.id,
        input.correlationId,
        JSON.stringify({ clinicLocationId: hold.clinic_location_id, summaryLength: clinicalSummary.length }),
      ]);

      return {
        holdId: hold.id,
        state: 'COMPLETED',
        slotId: hold.slot_id,
        correlationId: input.correlationId,
        clinicalSummary,
      };
    });
  }

  private async setShortTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '50ms'");
  }

  private assertCompletionAccess(employee: JwtPayload, clinicLocationId: string): void {
    const hasRole = employee.roles.includes(Role.CLINIC_ADMIN) || employee.roles.includes(Role.CLINIC_VETERINARIAN);
    if (!hasRole || !employee.locationIds?.includes(clinicLocationId)) {
      throw DomainErrors.clinicScopeMismatch();
    }
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
}
