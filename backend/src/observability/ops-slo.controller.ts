import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DatabaseService } from '../database/database.service';
import { ObservabilityMetricsService } from './observability.metrics';

interface SloSnapshotRow {
  server_now: Date;
  outbox_lag_seconds: string;
  outbox_pending_count: number;
  outbox_retry_count: number;
  mis_sync_lag_seconds: string;
  mis_pending_count: number;
  payment_reconciliation_count: number;
  telemed_queue_wait_seconds: string;
  clinic_response_sla_breach_count: number;
  permission_denied_count: number;
}

interface AuditEventRow {
  id: string;
  event_ref: string;
  occurred_at: Date;
  actor_type: string;
  actor_id: string | null;
  action: string;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string | null;
}

const AUDIT_ACTION = /^[a-zA-Z0-9._-]{2,96}$/;

@ApiTags('Operational readiness')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.SECURITY_AUDITOR)
@Controller('v1/ops')
export class OpsSloController {
  constructor(
    private readonly database: DatabaseService,
    private readonly metrics: ObservabilityMetricsService,
  ) {}

  @Get('slo-snapshot')
  @ApiOperation({ summary: 'Read operational SLO snapshot for dashboards' })
  @ApiOkResponse({ description: 'Aggregated technical and security metrics from PostgreSQL source of truth.' })
  async snapshot() {
    const result = await this.database.query<SloSnapshotRow>(`
      WITH server_time AS (SELECT clock_timestamp() AS now)
      SELECT
        server_time.now AS server_now,
        COALESCE((
          SELECT EXTRACT(EPOCH FROM server_time.now - MIN(created_at))::numeric(18, 3)
          FROM booking_schema.outbox_events
          WHERE status IN ('PENDING', 'LEASED')
        ), 0)::text AS outbox_lag_seconds,
        (
          SELECT count(*)::int
          FROM booking_schema.outbox_events
          WHERE status IN ('PENDING', 'LEASED')
        ) AS outbox_pending_count,
        (
          SELECT count(*)::int
          FROM booking_schema.outbox_events
          WHERE status IN ('PENDING', 'LEASED')
            AND attempts > 1
        ) AS outbox_retry_count,
        COALESCE((
          SELECT EXTRACT(EPOCH FROM server_time.now - MIN(created_at))::numeric(18, 3)
          FROM booking_schema.outbox_events
          WHERE event_type LIKE 'mis.%'
            AND status IN ('PENDING', 'LEASED')
        ), 0)::text AS mis_sync_lag_seconds,
        (
          SELECT count(*)::int
          FROM booking_schema.outbox_events
          WHERE event_type LIKE 'mis.%'
            AND status IN ('PENDING', 'LEASED')
        ) AS mis_pending_count,
        (
          SELECT count(*)::int
          FROM payment_schema.payment_intents
          WHERE status IN ('VOID_REQUESTED', 'REFUND_SENT')
             OR (capture_requested_at IS NOT NULL AND capture_sent_at IS NULL)
        ) AS payment_reconciliation_count,
        COALESCE((
          SELECT EXTRACT(EPOCH FROM AVG(server_time.now - created_at))::numeric(18, 3)
          FROM telemed_schema.telemed_cases
          WHERE state = 'QUEUED'
        ), 0)::text AS telemed_queue_wait_seconds,
        (
          SELECT count(*)::int
          FROM audit_schema.audit_log
          WHERE action IN ('CLINIC_MANUAL_CONFIRMATION_SLA_BREACHED', 'clinic.sla.breached')
            AND occurred_at >= server_time.now - interval '24 hours'
        ) AS clinic_response_sla_breach_count,
        (
          SELECT count(*)::int
          FROM audit_schema.audit_log
          WHERE action = 'permission.denied'
            AND occurred_at >= server_time.now - interval '1 hour'
        ) AS permission_denied_count
      FROM server_time
    `);
    const row = result.rows[0];
    const api = this.metrics.apiSnapshot();
    const pool = this.database.poolStats();
    return {
      serverNow: row.server_now.toISOString(),
      technical: {
        apiLatencyP95Ms: api.latencyP95Ms,
        apiErrorRate: api.errorRate,
        apiSamples: api.samples,
        connectionPoolInUse: pool.inUseCount,
        connectionPoolWaiting: pool.waitingCount,
        outboxLagSeconds: Number(row.outbox_lag_seconds),
        outboxPendingCount: row.outbox_pending_count,
        outboxRetryCount: row.outbox_retry_count,
        misSyncLagSeconds: Number(row.mis_sync_lag_seconds),
        misPendingCount: row.mis_pending_count,
        paymentReconciliationCount: row.payment_reconciliation_count,
        telemedQueueWaitSeconds: Number(row.telemed_queue_wait_seconds),
      },
      security: {
        permissionDeniedLastHour: row.permission_denied_count,
      },
      business: {
        clinicResponseSlaBreachesLast24h: row.clinic_response_sla_breach_count,
      },
    };
  }

  @Get('audit-events')
  @ApiOperation({ summary: 'Read latest security and compliance audit events' })
  @ApiOkResponse({ description: 'Latest append-only audit events for security dashboards.' })
  async auditEvents(
    @Query('action') action?: string,
    @Query('limit') limitValue?: string,
  ) {
    const limit = this.limit(limitValue);
    const actionFilter = this.action(action);
    const result = await this.database.query<AuditEventRow>(`
      SELECT id::text, event_ref, occurred_at, actor_type, actor_id, action,
             aggregate_type, aggregate_id::text, correlation_id::text
      FROM audit_schema.audit_log
      WHERE ($1::text IS NULL OR action = $1)
      ORDER BY occurred_at DESC, id DESC
      LIMIT $2
    `, [actionFilter, limit]);
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        eventRef: row.event_ref,
        occurredAt: row.occurred_at.toISOString(),
        actorType: row.actor_type,
        actorId: row.actor_id,
        action: row.action,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        correlationId: row.correlation_id,
      })),
    };
  }

  private limit(value: string | undefined): number {
    if (value === undefined) return 25;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100 || String(parsed) !== value.trim()) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'limit must be an integer from 1 to 100.' });
    }
    return parsed;
  }

  private action(value: string | undefined): string | null {
    if (value === undefined || value.trim() === '') return null;
    const normalized = value.trim();
    if (!AUDIT_ACTION.test(normalized)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'action filter is invalid.' });
    }
    return normalized;
  }
}
