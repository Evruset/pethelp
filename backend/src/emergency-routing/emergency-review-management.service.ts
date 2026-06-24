import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { EmergencyQueueRepository, PendingEmergencyReviewsPage } from './emergency-queue.repository';

export interface EmergencyRevokeResult {
  clinicId: string;
  correlationId: string;
  revokedReviewIds: string[];
  isEmergencyPublic: false;
}

@Injectable()
export class EmergencyReviewManagementService {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: EmergencyQueueRepository,
  ) {}

  async getPendingReviews(page: number, limit: number): Promise<PendingEmergencyReviewsPage> {
    return this.queue.getPendingReviews(page, limit);
  }

  /** Platform-admin command. It is intentionally idempotent for an already hidden clinic. */
  async revokeEmergencyCapabilities(
    clinicId: string,
    reason: string,
    platformAdminId: string,
    correlationId: string = randomUUID(),
  ): Promise<EmergencyRevokeResult> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 2_000) {
      throw new ForbiddenException({ code: 'EMERGENCY_REVOKE_REASON_INVALID', message: 'Revoke reason must contain 5 to 2000 characters' });
    }

    return this.database.withTransaction(async (client) => {
      await setBudget(client);
      await client.query("SELECT set_config('vethelp.emergency_ops_actor', 'PLATFORM_ADMIN', true)");

      const admin = await client.query<{ id: string }>('SELECT id::text FROM identity_schema.users WHERE id = $1::uuid FOR SHARE', [platformAdminId]);
      if (!admin.rows[0]) throw new ForbiddenException({ code: 'PLATFORM_ADMIN_UNKNOWN', message: 'Platform admin identity is not registered' });

      const clinic = await client.query<{ id: string }>('SELECT id::text FROM clinic_schema.clinics WHERE id = $1::uuid FOR UPDATE', [clinicId]);
      if (!clinic.rows[0]) throw new NotFoundException({ code: 'CLINIC_NOT_FOUND', message: 'Clinic not found' });

      const reviews = await client.query<{ id: string }>(`
        SELECT id::text
        FROM clinic_schema.emergency_capabilities_reviews
        WHERE clinic_id = $1::uuid
          AND status IN ('PENDING_REVIEW', 'VERIFIED')
        ORDER BY created_at, id
        FOR UPDATE
      `, [clinicId]);
      const reviewIds = reviews.rows.map((row) => row.id);

      if (reviewIds.length > 0) {
        await client.query(`
          UPDATE clinic_schema.emergency_capabilities_reviews
          SET status = 'REVOKED', updated_at = clock_timestamp()
          WHERE id = ANY($1::uuid[])
        `, [reviewIds]);
      }

      await client.query(`
        UPDATE clinic_schema.clinics
        SET is_emergency_public = false, updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [clinicId]);

      await client.query(`
        INSERT INTO audit_schema.audit_log (
          actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json
        ) VALUES (
          'USER', $1::text, 'EMERGENCY_CAPABILITIES_REVOKED', 'clinic', $2::uuid, $3::uuid,
          jsonb_build_object('reason', $4::text, 'reviewIds', $5::uuid[])
        )
      `, [platformAdminId, clinicId, correlationId, normalizedReason, reviewIds]);

      await client.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, correlation_id, aggregate_type, aggregate_id, aggregate_version,
          payload_json, deduplication_key
        ) VALUES (
          'clinic.emergency.revoked.v1', $1::uuid, 'clinic', $2::uuid, 1,
          jsonb_build_object('clinicId', $2::uuid, 'reason', $3::text, 'reviewIds', $4::uuid[]),
          'clinic.emergency.revoked.v1:' || $2::text || ':' || $1::text
        ) ON CONFLICT (deduplication_key) DO NOTHING
      `, [correlationId, clinicId, normalizedReason, reviewIds]);

      return { clinicId, correlationId, revokedReviewIds: reviewIds, isEmergencyPublic: false };
    });
  }
}

async function setBudget(client: PoolClient): Promise<void> {
  await client.query("SET LOCAL lock_timeout = '50ms'");
  await client.query("SET LOCAL statement_timeout = '50ms'");
}
