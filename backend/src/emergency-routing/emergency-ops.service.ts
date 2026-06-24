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

  async submitForReview(clinicId: string, evidenceUrl: string, actor: JwtPayload): Promise<EmergencyReviewResult> {
    if (!actor.roles.includes(Role.CLINIC_ADMIN)) throw new ForbiddenException({ code: 'CLINIC_ADMIN_REQUIRED' });
    assertEvidenceUrl(evidenceUrl);
    return this.database.withTransaction(async (client) => {
      await budget(client);
      await client.query("SELECT set_config('vethelp.emergency_ops_actor', 'SYSTEM_WORKER', true)");
      await activeScope(client, clinicId, actor.sub);
      await client.query("UPDATE clinic_schema.emergency_capabilities_reviews SET status = 'REVOKED', updated_at = clock_timestamp() WHERE clinic_id = $1::uuid AND status IN ('PENDING_REVIEW', 'VERIFIED')", [clinicId]);
      await client.query('UPDATE clinic_schema.clinics SET is_emergency_public = false, updated_at = clock_timestamp() WHERE id = $1::uuid', [clinicId]);
      const result = await client.query<{ id: string }>("INSERT INTO clinic_schema.emergency_capabilities_reviews (clinic_id, status, evidence_url) VALUES ($1::uuid, 'PENDING_REVIEW', $2::text) RETURNING id::text", [clinicId, evidenceUrl.trim()]);
      const reviewId = result.rows[0].id;
      await audit(client, 'EMERGENCY_REVIEW_SUBMITTED', clinicId, actor.sub, { reviewId, evidenceUrl: evidenceUrl.trim() });
      return { reviewId, clinicId, status: 'PENDING_REVIEW', expiresAt: null };
    });
  }

  async approveEmergencyProfile(reviewId: string, platformAdminId: string): Promise<EmergencyReviewResult> {
    return this.database.withTransaction(async (client) => {
      await budget(client);
      await client.query("SELECT set_config('vethelp.emergency_ops_actor', 'PLATFORM_ADMIN', true)");
      const review = await client.query<{ clinic_id: string; status: string }>('SELECT clinic_id::text, status FROM clinic_schema.emergency_capabilities_reviews WHERE id = $1::uuid FOR UPDATE', [reviewId]);
      const current = review.rows[0];
      if (!current) throw new NotFoundException({ code: 'EMERGENCY_REVIEW_NOT_FOUND' });
      if (current.status !== 'PENDING_REVIEW') throw new UnprocessableEntityException({ code: 'EMERGENCY_REVIEW_NOT_PENDING' });
      const admin = await client.query<{ id: string }>('SELECT id::text FROM identity_schema.users WHERE id = $1::uuid FOR SHARE', [platformAdminId]);
      if (!admin.rows[0]) throw new ForbiddenException({ code: 'PLATFORM_ADMIN_UNKNOWN' });
      const approved = await client.query<{ expires_at: Date }>("UPDATE clinic_schema.emergency_capabilities_reviews SET status = 'VERIFIED', verified_by = $2::uuid, expires_at = clock_timestamp() + interval '90 days', updated_at = clock_timestamp() WHERE id = $1::uuid AND status = 'PENDING_REVIEW' RETURNING expires_at", [reviewId, platformAdminId]);
      if (!approved.rows[0]) throw new UnprocessableEntityException({ code: 'EMERGENCY_REVIEW_STATE_RACE' });
      await client.query('UPDATE clinic_schema.clinics SET is_emergency_public = true, updated_at = clock_timestamp() WHERE id = $1::uuid', [current.clinic_id]);
      const expiresAt = approved.rows[0].expires_at.toISOString();
      await audit(client, 'EMERGENCY_REVIEW_APPROVED', current.clinic_id, platformAdminId, { reviewId, expiresAt });
      return { reviewId, clinicId: current.clinic_id, status: 'VERIFIED', expiresAt };
    });
  }

  async expireOneDueReview(): Promise<boolean> {
    return this.database.withTransaction(async (client) => {
      await budget(client);
      await client.query("SELECT set_config('vethelp.emergency_ops_actor', 'SYSTEM_WORKER', true)");
      const selected = await client.query<{ id: string; clinic_id: string }>("SELECT id::text, clinic_id::text FROM clinic_schema.emergency_capabilities_reviews WHERE status = 'VERIFIED' AND expires_at < clock_timestamp() ORDER BY expires_at, id FOR UPDATE SKIP LOCKED LIMIT 1");
      const review = selected.rows[0];
      if (!review) return false;
      const expired = await client.query<{ id: string }>("UPDATE clinic_schema.emergency_capabilities_reviews SET status = 'EXPIRED', updated_at = clock_timestamp() WHERE id = $1::uuid AND status = 'VERIFIED' AND expires_at < clock_timestamp() RETURNING id::text", [review.id]);
      if (!expired.rows[0]) return false;
      await client.query('UPDATE clinic_schema.clinics SET is_emergency_public = false, updated_at = clock_timestamp() WHERE id = $1::uuid', [review.clinic_id]);
      await client.query("INSERT INTO booking_schema.outbox_events (event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key) VALUES ('alert.stale_emergency_profile.v1', 'clinic', $1::uuid, 1, jsonb_build_object('alert_type','STALE_EMERGENCY_PROFILE','clinicId',$1::uuid,'reviewId',$2::uuid), 'alert.stale_emergency_profile.v1:' || $2::text) ON CONFLICT (deduplication_key) DO NOTHING", [review.clinic_id, review.id]);
      await audit(client, 'STALE_EMERGENCY_PROFILE', review.clinic_id, null, { reviewId: review.id });
      return true;
    });
  }
}

async function budget(client: PoolClient): Promise<void> {
  await client.query("SET LOCAL lock_timeout = '50ms'");
  await client.query("SET LOCAL statement_timeout = '50ms'");
}

async function activeScope(client: PoolClient, clinicId: string, employeeId: string): Promise<void> {
  const clinic = await client.query<{ id: string }>('SELECT id::text FROM clinic_schema.clinics WHERE id = $1::uuid FOR UPDATE', [clinicId]);
  if (!clinic.rows[0]) throw new NotFoundException({ code: 'CLINIC_NOT_FOUND' });
  const access = await client.query<{ employee_id: string }>("SELECT m.employee_id::text FROM clinic_schema.employee_location_memberships m JOIN clinic_schema.clinic_locations l ON l.id = m.clinic_location_id WHERE l.clinic_id = $1::uuid AND m.employee_id = $2::uuid AND m.active = true FOR SHARE LIMIT 1", [clinicId, employeeId]);
  if (!access.rows[0]) throw new ForbiddenException({ code: 'CLINIC_SCOPE_MISMATCH' });
}

async function audit(client: PoolClient, action: string, clinicId: string, actorId: string | null, payload: Record<string, unknown>): Promise<void> {
  await client.query("INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json) VALUES ($1, $2, $3, 'clinic', $4::uuid, $5::jsonb)", [actorId ? 'USER' : 'SYSTEM', actorId, action, clinicId, JSON.stringify(payload)]);
}

function assertEvidenceUrl(value: string): void {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('scheme');
  } catch {
    throw new UnprocessableEntityException({ code: 'EMERGENCY_EVIDENCE_URL_INVALID' });
  }
}
