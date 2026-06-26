import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { config } from '../../config';
import { DatabaseService } from '../../database/database.service';
import { IMisAdapter, MisConfigurationError, MisNetworkError, MisReservationLookupResult } from './interfaces/mis-adapter.interface';
import { MisReservationRequestedPayload } from './interfaces/mis-event.interface';
import { MisAdapterFactory } from './mis-adapter.factory';
import { MisCommandDispatcherService } from './mis-command-dispatcher.service';

interface MisReconciliationCandidate {
  hold_id: string;
  slot_id: string;
  clinic_id: string;
  mis_type: string | null;
  external_patient_id: string | null;
  correlation_id: string | null;
}

@Injectable()
export class MisReconciliationSweeperWorker {
  private readonly logger = new Logger(MisReconciliationSweeperWorker.name);
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly adapterFactory: MisAdapterFactory,
    private readonly dispatcher: MisCommandDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile(): Promise<void> {
    if (!config.workersEnabled || this.running) return;
    this.running = true;

    try {
      await this.reconcileStaleReservations(10);
    } finally {
      this.running = false;
    }
  }

  async reconcileStaleReservations(limit = 10, minAgeSeconds = 30): Promise<number> {
    const candidates = await this.claimCandidates(limit, minAgeSeconds);
    let resolved = 0;

    for (const candidate of candidates) {
      const payload = this.toPayload(candidate);
      if (!payload.externalPatientId) {
        await this.dispatcher.commitReservationFailure(payload, 'Pet is not mapped to an external MIS patient');
        resolved += 1;
        continue;
      }

      let adapter: IMisAdapter;
      try {
        if (!candidate.mis_type) throw new MisConfigurationError('Clinic MIS type is not configured');
        adapter = this.adapterFactory.getAdapter(candidate.mis_type);
      } catch (error) {
        await this.dispatcher.commitReservationFailure(payload, this.errorMessage(error));
        resolved += 1;
        continue;
      }

      try {
        const result = await adapter.lookupReservation({
          internalHoldId: candidate.hold_id,
          correlationId: candidate.correlation_id ?? undefined,
        });
        if (await this.applyLookupResult(payload, result)) resolved += 1;
      } catch (error) {
        const message = this.errorMessage(error);
        this.logger.warn(`MIS reconciliation lookup for hold ${candidate.hold_id} remains ambiguous: ${message}`);
      }
    }

    return resolved;
  }

  private async applyLookupResult(payload: MisReservationRequestedPayload, result: MisReservationLookupResult): Promise<boolean> {
    if (result.status === 'SUCCESS') {
      await this.dispatcher.commitReservationSuccess(payload, {
        status: 'SUCCESS',
        externalHoldId: result.externalHoldId,
        ttlMinutes: result.ttlMinutes,
      });
      return true;
    }
    if (result.status === 'FAILED' || result.status === 'NOT_FOUND') {
      await this.dispatcher.commitReservationFailure(payload, result.rawError ?? `MIS reservation lookup returned ${result.status}`);
      return true;
    }
    this.logger.warn(`MIS reconciliation for hold ${payload.holdId} returned UNKNOWN: ${result.rawError ?? 'no details'}`);
    return false;
  }

  private async claimCandidates(limit: number, minAgeSeconds: number): Promise<MisReconciliationCandidate[]> {
    const result = await this.database.query<MisReconciliationCandidate>(`
      WITH candidates AS (
        SELECT
          h.id AS hold_id,
          h.slot_id,
          c.id AS clinic_id,
          c.mis_type,
          p.external_patient_id,
          o.correlation_id::text AS correlation_id
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations l ON l.id = s.clinic_location_id
        JOIN clinic_schema.clinics c ON c.id = l.clinic_id
        JOIN pet_schema.pets p ON p.id = h.pet_id
        LEFT JOIN LATERAL (
          SELECT correlation_id
          FROM booking_schema.outbox_events
          WHERE aggregate_type = 'booking_hold'
            AND aggregate_id = h.id
            AND event_type = 'mis.reservation.requested.v1'
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        ) o ON true
        WHERE h.state IN ('MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING')
          AND COALESCE(h.mis_processed_at, h.state_changed_at, h.updated_at) <= clock_timestamp() - ($2::text || ' seconds')::interval
        ORDER BY COALESCE(h.mis_processed_at, h.state_changed_at, h.updated_at), h.id
        FOR UPDATE OF h SKIP LOCKED
        LIMIT $1
      )
      UPDATE booking_schema.booking_holds h
      SET mis_processed_at = clock_timestamp(),
          updated_at = clock_timestamp()
      FROM candidates
      WHERE h.id = candidates.hold_id
      RETURNING
        candidates.hold_id,
        candidates.slot_id,
        candidates.clinic_id,
        candidates.mis_type,
        candidates.external_patient_id,
        candidates.correlation_id
    `, [limit, minAgeSeconds]);
    return result.rows;
  }

  private toPayload(candidate: MisReconciliationCandidate): MisReservationRequestedPayload {
    return {
      holdId: candidate.hold_id,
      slotId: candidate.slot_id,
      clinicId: candidate.clinic_id,
      externalPatientId: candidate.external_patient_id ?? '',
      correlationId: candidate.correlation_id ?? undefined,
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof MisConfigurationError || error instanceof MisNetworkError || error instanceof Error) return error.message.slice(0, 1000);
    return 'MIS reconciliation failed';
  }
}
