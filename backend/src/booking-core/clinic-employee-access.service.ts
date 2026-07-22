import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Capability } from '../auth/capability';
import { CapabilityEvaluatorService } from '../auth/capability-evaluator.service';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { featureFlags } from '../config/feature-flags.config';

/**
 * Database-backed ABAC enforcement for clinic portal commands. JWT location
 * claims are an early reject only; the active membership row remains the
 * authoritative source inside the same transaction as the state change.
 */
@Injectable()
export class ClinicEmployeeAccessService {
  constructor(private readonly capabilities: CapabilityEvaluatorService = new CapabilityEvaluatorService()) {}
  async assertLocationAccess(client: PoolClient, employee: JwtPayload, clinicLocationId: string): Promise<void> {
    if (!employee.roles.includes(Role.CLINIC_RECEPTIONIST) && !employee.roles.includes(Role.CLINIC_ADMIN)) {
      throw DomainErrors.clinicScopeMismatch();
    }
    if (!employee.locationIds?.includes(clinicLocationId)) throw DomainErrors.clinicScopeMismatch();
    const membership = await client.query<{ employee_id: string; clinic_id: string }>(`
      SELECT membership.employee_id, location.clinic_id::text
      FROM clinic_schema.employee_location_memberships membership
      JOIN clinic_schema.clinic_locations location ON location.id = membership.clinic_location_id
      WHERE membership.employee_id = $1::uuid
        AND membership.clinic_location_id = $2::uuid
        AND membership.active = true
        AND membership.revoked_at IS NULL
      FOR SHARE OF membership, location
    `, [employee.sub, clinicLocationId]);
    if (!membership.rows[0] || !employee.clinicIds?.includes(membership.rows[0].clinic_id)) {
      throw DomainErrors.clinicScopeMismatch();
    }
  }

  async assertBookingQueueReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.CAPABILITY_EVALUATOR_V1) {
      return this.assertLocationAccess(client, employee, clinicLocationId);
    }
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.BOOKING_QUEUE_READ, resource: { aggregateType: 'booking.queue', clinicId, locationId: clinicLocationId } });
  }

  async assertQualityReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.QUALITY_READ_CAPABILITY_V1) return this.assertLocationAccess(client, employee, clinicLocationId);
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.QUALITY_READ, resource: { aggregateType: 'quality.dashboard', clinicId, locationId: clinicLocationId } });
  }

  async assertScheduleReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.SCHEDULE_READ_CAPABILITY_V1) return this.assertLocationAccess(client, employee, clinicLocationId);
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.SCHEDULE_READ, resource: { aggregateType: 'schedule.slots', clinicId, locationId: clinicLocationId } });
  }

  async assertBookingReplayReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.BOOKING_REPLAY_READ_CAPABILITY_V1) return this.assertLocationAccess(client, employee, clinicLocationId);
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.BOOKING_REPLAY_READ, resource: { aggregateType: 'booking.hold.replay', clinicId, locationId: clinicLocationId } });
  }

  async assertBookingHoldReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.BOOKING_HOLD_READ_CAPABILITY_V1) return this.assertLocationAccess(client, employee, clinicLocationId);
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.BOOKING_HOLD_READ, resource: { aggregateType: 'booking.hold', clinicId, locationId: clinicLocationId } });
  }

  async assertClinicalVisitCompletionAccess(
    client: PoolClient,
    employee: JwtPayload,
    clinicLocationId: string,
  ): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.CLINICAL_VISIT_COMPLETE, resource: { aggregateType: 'clinical.visit', locationId: clinicLocationId } });
  }

  async assertClinicalVisitWorkspaceReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.CLINICAL_VISIT_WORKSPACE_READ, resource: { aggregateType: 'clinical.visit.workspace', clinicId, locationId: clinicLocationId } });
  }
}
