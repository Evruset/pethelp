import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload, Role } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

export interface EmergencyReviewResult {
  reviewId: string;
  clinicId: string;
  status: 'PENDING_REVIEW' | 'VERIFIED';
  expiresAt: string | null;
}

@Injectable()
export class EmergencyOpsService {
  constructor(private readonly database: DatabaseService) {}

  /** A clinic admin submits evidence; previous active approval is revoked and hidden atomically. */
  async submitForReview(clinicId: string, evidenceUrl: string, employeeContext: JwtPayload): Promise<EmergencyReviewResult> {
    if (!employeeContext.roles.includes(Role.CLINIC_ADMIN)) {
      throw new ForbiddenException({ code: 'CLINIC_ADMIN_REQUIRED', message: 'Clinic admin role is required for emergency review submission' });
    }
    assertEvidenceUrl(evidenceUrl);

    return this.database.withTransaction(async (runner) => {
      await setBudget(runner);
      await runner.query("SELECT set_config('vethelp.emergency_ops_actor', 'SYSTEM_WORKER', true)");
      await assertClinicMembership(runner, clinicId, employeeContext.sub);

      await runner.query(`
        UPDATE clinic_schema.emergency_capabilities_reviews
        SET status = 'REVOKED', updated_at = clock_timestamp()
        WHERE clinic_id = $1::uuid
          AND status IN ('PENDING_REVIEW', 'VERIFIED')
      `, [clinicId]);

      await runner.query(`
        UPDATE clinic_schema.clinics
        SET is_emergency_public = false, updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [clinicId]);

      const created = await runner.query<{ id: string; created_at: Date }>(`
        INSERT INTO clinic_schema.emergency_capabilities_reviews (
          clinic_id, status, evidence_url, updated_at
        ) VALUES ($1::uuid, 'PENDING_REVIEW', $2::text, clock_timestamp())
        RETURNING id::text, created_at
      `, [clinicId, evidenceUrl.trim()]);
      const review = created.rows[0];

      await audit(runner, 'EMERGENCY_REVIEW_SUBMITTED', clinicId, employeeContext.sub, {
        reviewId: review.id,
        evidenceUrl: evidenceUrl.trim(),
      });

      return { reviewId: review.id, clinicId, status: 'PENDING_REVIEW', expiresAt: null };
    });
  }

  /** Caller must be protected by PLATFORM_ADMIN controller guard. */
  async approveEmergencyProfile(reviewId: string, platformAdminId: string): Promise<EmergencyReviewResult> {
    return this.database.withTransaction(async (runner) => {
      await setBudget(runner);
      await runner.query("SELECT set_config('vethelp.emergency_ops_actor', 'PLATFORM_ADMIN', true)");
      const review = await runner.query<{ id: string; clinic_id: string; status: string }>(`
        SELECT id::text, clinic_id::text, status
        FROM clinic_schema.emergency_capabilities_reviews
        WHERE id = $1::uuid
        FOR UPDATE
      `, [reviewId]);
      const current = review.rows[0];
      if (!current) throw new NotFoundException({ code: 'EMERGENCY_REVIEW_NOT_FOUND', message: 'Emergency review not found' });
      if (current.status !== 'PENDING_REVIEW') {
        throw new UnprocessableEntityException({ code: 'EMERGENCY_REVIEW_NOT_PENDING', message: 'Only pending emergency reviews may be approved' });
      }

      const platformAdmin = await runner.query<{ id: string }>('SELECT id::text FROM identity_schema.users WHERE id = $1::uuid FOR SHARE', [platformAdminId]);
      if (!platformAdmin.rows[0]) {
        throw new ForbiddenException({ code: 'PLATFORM_ADMIN_UNKNOWN', message: 'Platform admin identity is not registered' });
      }

      const approved = await runner.query<{ expires_at: Date }>(`
        UPDATE clinic_schema.emergency_capabilities_reviews
        SET status = 'VERIFIED', verified_by = $2::uuid,
            expires_at = clock_timestamp() + interval '90 days',
            updated_at = clock_timestamp()
        WHERE id = $1::uuid AND status = 'PENDING_REVIEW'
        RETURNING expires_at
      `, [reviewId, platformAdminId]);
      if (!approved.rows[0]) throw new UnprocessableEntityException({ code: 'EMERGENCY_REVIEW_STATE_RACE', message: 'Emergency review was updated concurrently' });

      await runner.query(`
        UPDATE clinic_schema.clinics
        SET is_emergency_public = true, updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [current.clinic_id]);

      await audit(runner, 'EMERGENCY_REVIEW_APPROVED', current.clinic_id, platformAdminId, {
        reviewId,
        expiresAt: approved.rows[0].expires_at.toISOString(),
      });

      return {
        reviewId,
        clinicId: current.clinic_id,
        status: 'VERIFIED',
        expiresAt: approved.rows[0].expires_at.toISOString(),
      };
    });
  }

  async expireOneDueReview(): Promise<boolean> {
    return this.database.withTransaction(async (runner) => {
      await setBudget(runner);
      await runner.query("SELECT set_config('vethelp.emergency_ops_actor', 'SYSTEM_WORKER', true)");
      const review = await runner.query<{ id: string; clinic_id: string }>(`
        SELECT id::text, clinic_id::text
        FROM clinic_schema.emergency_capabilities_reviews
        WHERE status = 'VERIFIED' AND expires_at < clock_timestamp()
        ORDER BY expires_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const current = review.rows[0];
      if (!current) return false;

      const expired = await runner.query<{ id: string }>(`
        UPDATE clinic_schema.emergency_capabilities_reviews
        SET status = 'EXPIRED', updated_at = clock_timestamp()
        WHERE id = $1::uuid AND status = 'VERIFIED' AND expires_at < clock_timestamp()
        RETURNING id::text
      `, [current.id]);
      if (!expired.rows[0]) return false;

      await runner.query(`
        UPDATE clinic_schema.clinics
        SET is_emergency_public = false, updated_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [current.clinic_id]);

      await runner.query(`
        INSERT INTO booking_schema.outbox_events (
          event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key
        ) VALUES (
          'alert.stale_emergency_profile.v1', 'clinic', $1::uuid, 1,
          jsonb_build_object('alert_type', 'STALE_EMERGENCY_PROFILE', 'clinicId', $1::uuid, 'reviewId', $2::uuid),
          'alert.stale_emergency_profile.v1:' || $2::text
        ) ON CONFLICT (deduplication_key) DO NOTHING
      `, [current.clinic_id, current.id]);

      await audit(runner, 'STALE_EMERGENCY_PROFILE', current.clinic_id, null, { reviewId: current.id });
      return true;
    });
  }
}

async function setBudget(runner: PoolClient): Promise<void> {
  await runner.query("SET LOCAL lock_timeout = '50ms'");
  await runner.query("SET LOCAL statement_timeout = '50ms'");
}

async function assertClinicMembership(runner: PoolClient, clinicId: string, employeeId: string): Promise<void> {
  const clinic = await runner.query<{ id: string }>('SELECT id::text FROM clinic_schema.clinics WHERE id = $1::uuid FOR UPDATE', [clinicId]);
  if (!clinic.rows[0]) throw new NotFoundException({ code: 'CLINIC_NOT_FOUND', message: 'Clinic not found' });

  const membership = await runner.query<{ employee_id: string }>(`
    SELECT m.employee_id::text
    FROM clinic_schema.employee_location_memberships m
    JOIN clinic_schema.clinic_locations l ON l.id = m.clinic_location_id
    WHERE l.clinic_id = $1::uuid AND m.employee_id = $2::uuid
    FOR SHARE
    LIMIT 1
  `, [clinicId, employeeId]);
  if (!membership.rows[0]) throw new ForbiddenException({ code: 'CLINIC_SCOPE_MISMATCH', message: 'Employee has no active clinic membership' });
}

async function audit(runner: PoolClient, action: string, clinicId: string, actorId: string | null, payload: Record<string, unknown>): Promise<void> {
  await runner.query(`
    INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json)
    VALUES ($1, $2, $3, 'clinic', $4::uuid, $5::jsonb)
  `, [actorId ? 'USER' : 'SYSTEM', actorId, action, clinicId, JSON.stringify(payload)]);
}

function assertEvidenceUrl(value: string): void {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported scheme');
  } catch {
    throw new UnprocessableEntityException({ code: 'EMERGENCY_EVIDENCE_URL_INVALID', message: 'evidenceUrl must be an absolute HTTP(S) URL' });
  }
}
