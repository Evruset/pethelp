import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Capability, hasCapability } from '../auth/capability';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicWorkspaceHomeTelemetry } from '../observability/clinic-workspace-home-telemetry';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import {
  AppointmentsAvailableSectionDto, ClinicWorkspaceHomeDto, QueueAvailableSectionDto,
  QueueOldestWaitAgeBucket, QueueSlaRisk, WorkspaceActionLabelKey, WorkspaceActionRoute,
  WorkspaceAvailability, WorkspaceFreshnessState, WorkspaceSectionKind, WorkspaceUnavailableSectionDto,
} from './dto/clinic-workspace-home.dto';

const TERMINAL_APPOINTMENT_STATUSES = ['COMPLETED', 'NO_SHOW', 'CLINIC_CANCELLED', 'CANCELLED'] as const;
const MAX_COUNT = 999;
const RECOVERABLE_SECTION_SQLSTATES = new Set(['57014', '55P03']);

type QueueSummaryRow = { waiting_count: string; requires_action_count: string; oldest_age_seconds: string | null; has_overdue: boolean; has_due_soon: boolean; has_inconsistent: boolean };
type AppointmentSummaryRow = { today_count: string; requires_action_count: string; next_scheduled_at: Date | null };

@Injectable()
export class ClinicWorkspaceHomeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: ClinicEmployeeAccessService,
    private readonly telemetry: ClinicWorkspaceHomeTelemetry,
  ) {}

  async read(input: { clinicId: string; locationId: string; employee: JwtPayload }): Promise<ClinicWorkspaceHomeDto> {
    const startedAt = performance.now();
    try {
      const result = await this.database.withTransaction(async (client) => {
        await client.query("SET LOCAL statement_timeout = '500ms'");
        const authority = await this.access.assertExactClinicLocationMembership(client, input.employee, input.clinicId, input.locationId);
        const generatedAt = authority.serverNow.toISOString();
        const queueAllowed = hasCapability(input.employee, Capability.BOOKING_QUEUE_READ);
        const appointmentsAllowed = hasCapability(input.employee, Capability.APPOINTMENT_REGISTRY_READ);
        const scheduleAllowed = hasCapability(input.employee, Capability.SCHEDULE_READ);
        const veterinarianAllowed = hasCapability(input.employee, Capability.CLINICAL_VISIT_WORKSPACE_READ);
        const qualityAllowed = hasCapability(input.employee, Capability.QUALITY_READ);
        if (!queueAllowed && !appointmentsAllowed && !scheduleAllowed && !veterinarianAllowed && !qualityAllowed) {
          throw DomainErrors.clinicScopeMismatch();
        }

        const queue = queueAllowed
          ? await this.withSectionSavepoint(client, 'workspace_queue', () => this.queueSummary(client, input.locationId, authority.serverNow), WorkspaceSectionKind.QUEUE, generatedAt)
          : this.unavailable(WorkspaceSectionKind.QUEUE, WorkspaceAvailability.NOT_AUTHORIZED, generatedAt);
        const schedule = this.unavailable(WorkspaceSectionKind.SCHEDULE, scheduleAllowed ? WorkspaceAvailability.NOT_CONFIGURED : WorkspaceAvailability.NOT_AUTHORIZED, generatedAt);
        const appointments = appointmentsAllowed
          ? await this.withSectionSavepoint(client, 'workspace_appointments', () => this.appointmentsSummary(client, input.locationId, authority.timezone, authority.serverNow), WorkspaceSectionKind.APPOINTMENTS, generatedAt)
          : this.unavailable(WorkspaceSectionKind.APPOINTMENTS, WorkspaceAvailability.NOT_AUTHORIZED, generatedAt);
        const veterinarian = this.unavailable(WorkspaceSectionKind.VETERINARIAN, veterinarianAllowed ? WorkspaceAvailability.NOT_CONFIGURED : WorkspaceAvailability.NOT_AUTHORIZED, generatedAt);
        const quality = this.unavailable(WorkspaceSectionKind.QUALITY, qualityAllowed ? WorkspaceAvailability.NOT_CONFIGURED : WorkspaceAvailability.NOT_AUTHORIZED, generatedAt);

        return {
          clinicId: input.clinicId,
          locationId: input.locationId,
          serverNow: generatedAt,
          generatedAt,
          freshness: { state: WorkspaceFreshnessState.FRESH, maxAgeSeconds: 30 },
          sections: [queue, schedule, appointments, veterinarian, quality],
        } as ClinicWorkspaceHomeDto;
      }, { isolationLevel: 'REPEATABLE READ', readOnly: true });
      this.recordTelemetry(result, input.employee.roles, performance.now() - startedAt);
      return result;
    } catch (error) {
      const outcome = error instanceof HttpException && error.getStatus() === HttpStatus.FORBIDDEN
        ? 'AUTH_DENIED'
        : 'TECHNICAL_ERROR';
      this.telemetry.record({ outcome, roles: input.employee.roles, availableSections: [], notAuthorizedSections: [], notConfiguredSections: [], degradedSections: [], freshnessState: 'FRESH', durationMs: performance.now() - startedAt });
      throw error;
    }
  }

  private async withSectionSavepoint<T>(client: PoolClient, name: 'workspace_queue' | 'workspace_appointments', work: () => Promise<T>, kind: WorkspaceSectionKind, generatedAt: string): Promise<T | WorkspaceUnavailableSectionDto> {
    await client.query(`SAVEPOINT ${name}`);
    try {
      const value = await work();
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return value;
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
      if (!RECOVERABLE_SECTION_SQLSTATES.has(code)) throw error;
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      await client.query(`RELEASE SAVEPOINT ${name}`);
      return this.unavailable(kind, WorkspaceAvailability.TEMPORARILY_UNAVAILABLE, generatedAt);
    }
  }

  private async queueSummary(client: PoolClient, locationId: string, serverNow: Date): Promise<QueueAvailableSectionDto> {
    const result = await client.query<QueueSummaryRow>(`
      SELECT COUNT(*)::text AS waiting_count,
             COUNT(*) FILTER (WHERE hold.confirmation_sla_expires_at <= $2::timestamptz + interval '5 minutes')::text AS requires_action_count,
             EXTRACT(EPOCH FROM ($2::timestamptz - MIN(hold.state_changed_at)))::text AS oldest_age_seconds,
             COALESCE(bool_or(hold.confirmation_sla_expires_at <= $2::timestamptz), false) AS has_overdue,
             COALESCE(bool_or(hold.confirmation_sla_expires_at > $2::timestamptz AND hold.confirmation_sla_expires_at <= $2::timestamptz + interval '5 minutes'), false) AS has_due_soon,
             COALESCE(bool_or(hold.state_changed_at > $2::timestamptz OR hold.confirmation_sla_expires_at < hold.state_changed_at), false) AS has_inconsistent
      FROM (
        SELECT scoped_hold.slot_id, scoped_hold.state_changed_at, scoped_hold.confirmation_sla_expires_at
        FROM booking_schema.booking_holds scoped_hold
        WHERE scoped_hold.state = 'MANUAL_CONFIRM_PENDING'
          AND scoped_hold.confirmation_sla_expires_at IS NOT NULL
        ORDER BY scoped_hold.state_changed_at, scoped_hold.id
        OFFSET 0
      ) hold
      JOIN clinic_schema.appointment_slots slot
        ON slot.id = hold.slot_id
       AND slot.clinic_location_id = $1::uuid
    `, [locationId, serverNow]);
    const row = result.rows[0];
    const age = row.oldest_age_seconds === null ? null : Number(row.oldest_age_seconds);
    return {
      kind: WorkspaceSectionKind.QUEUE,
      availability: WorkspaceAvailability.AVAILABLE,
      generatedAt: serverNow.toISOString(),
      facts: {
        waitingCount: this.saturate(row.waiting_count),
        requiresActionCount: this.saturate(row.requires_action_count),
        oldestWaitAgeBucket: this.ageBucket(age),
        slaRisk: row.has_inconsistent ? QueueSlaRisk.UNKNOWN : row.has_overdue ? QueueSlaRisk.OVERDUE : row.has_due_soon ? QueueSlaRisk.DUE_SOON : QueueSlaRisk.NONE,
      },
      action: { route: WorkspaceActionRoute.QUEUE, labelKey: WorkspaceActionLabelKey.OPEN_QUEUE },
    };
  }

  private async appointmentsSummary(client: PoolClient, locationId: string, timezone: string, serverNow: Date): Promise<AppointmentsAvailableSectionDto> {
    const result = await client.query<AppointmentSummaryRow>(`
      WITH bounds AS (
        SELECT (($2::timestamptz AT TIME ZONE $3)::date AT TIME ZONE $3) AS day_start,
               ((($2::timestamptz AT TIME ZONE $3)::date + 1) AT TIME ZONE $3) AS day_end
      )
      SELECT COUNT(*) FILTER (
               WHERE slot.starts_at >= bounds.day_start AND slot.starts_at < bounds.day_end
                 AND appointment.status NOT IN ('CLINIC_CANCELLED', 'CANCELLED')
             )::text AS today_count,
             COUNT(*) FILTER (
               WHERE appointment.status <> ALL($4::text[]) AND slot.ends_at <= $2::timestamptz
             )::text AS requires_action_count,
             MIN(slot.starts_at) FILTER (
               WHERE appointment.status <> ALL($4::text[]) AND slot.starts_at > $2::timestamptz
             ) AS next_scheduled_at
      FROM (
        SELECT scoped_slot.id, scoped_slot.starts_at, scoped_slot.ends_at
        FROM clinic_schema.appointment_slots scoped_slot
        WHERE scoped_slot.clinic_location_id = $1::uuid
        ORDER BY scoped_slot.starts_at, scoped_slot.id
        OFFSET 0
      ) slot
      JOIN LATERAL (
        SELECT scoped.status
        FROM booking_schema.appointments scoped
        WHERE scoped.slot_id = slot.id
          AND scoped.clinic_location_id = $1::uuid
        OFFSET 0
      ) appointment ON true
      CROSS JOIN bounds
    `, [locationId, serverNow, timezone, TERMINAL_APPOINTMENT_STATUSES]);
    const row = result.rows[0];
    return {
      kind: WorkspaceSectionKind.APPOINTMENTS,
      availability: WorkspaceAvailability.AVAILABLE,
      generatedAt: serverNow.toISOString(),
      facts: {
        todayCount: this.saturate(row.today_count),
        requiresActionCount: this.saturate(row.requires_action_count),
        nextScheduledAt: row.next_scheduled_at?.toISOString() ?? null,
      },
      action: { route: WorkspaceActionRoute.APPOINTMENTS, labelKey: WorkspaceActionLabelKey.OPEN_APPOINTMENTS },
    };
  }

  private unavailable(kind: WorkspaceSectionKind, availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.NOT_CONFIGURED | WorkspaceAvailability.TEMPORARILY_UNAVAILABLE, generatedAt: string): WorkspaceUnavailableSectionDto {
    return { kind, availability, generatedAt };
  }

  private saturate(value: string): number { return Math.min(MAX_COUNT, Math.max(0, Number(value))); }
  private ageBucket(seconds: number | null): QueueOldestWaitAgeBucket {
    if (seconds === null) return QueueOldestWaitAgeBucket.NONE;
    if (seconds < 300) return QueueOldestWaitAgeBucket.LT_5_MIN;
    if (seconds < 600) return QueueOldestWaitAgeBucket.FIVE_TO_10_MIN;
    if (seconds < 1800) return QueueOldestWaitAgeBucket.TEN_TO_30_MIN;
    return QueueOldestWaitAgeBucket.GT_30_MIN;
  }

  private recordTelemetry(result: ClinicWorkspaceHomeDto, roles: readonly Role[], durationMs: number): void {
    const buckets = { available: [] as string[], unauthorized: [] as string[], unconfigured: [] as string[], degraded: [] as string[] };
    for (const section of result.sections) {
      if (section.availability === WorkspaceAvailability.AVAILABLE) buckets.available.push(section.kind);
      else if (section.availability === WorkspaceAvailability.NOT_AUTHORIZED) buckets.unauthorized.push(section.kind);
      else if (section.availability === WorkspaceAvailability.NOT_CONFIGURED) buckets.unconfigured.push(section.kind);
      else buckets.degraded.push(section.kind);
    }
    this.telemetry.record({ outcome: buckets.degraded.length ? 'PARTIAL' : 'COMPLETE', roles, availableSections: buckets.available, notAuthorizedSections: buckets.unauthorized, notConfiguredSections: buckets.unconfigured, degradedSections: buckets.degraded, freshnessState: result.freshness.state, durationMs });
  }
}
