import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { Capability, hasCapability } from '../auth/capability';
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

  /**
   * Common Workspace Home authority gate. JWT scopes are early rejects; one
   * database statement remains authoritative for membership and exact tenant
   * scope. Section capability checks run only after this gate succeeds.
   */
  async assertExactClinicLocationMembership(
    client: PoolClient,
    employee: JwtPayload,
    clinicId: string,
    locationId: string,
  ): Promise<{ serverNow: Date; timezone: string }> {
    if (!employee.clinicIds?.includes(clinicId) || !employee.locationIds?.includes(locationId)) {
      throw DomainErrors.clinicScopeMismatch();
    }
    const authority = await client.query<{ server_now: Date; timezone: string }>(`
      SELECT transaction_timestamp() AS server_now, clinic.timezone
      FROM clinic_schema.employee_location_memberships membership
      JOIN clinic_schema.clinic_locations location
        ON location.id = membership.clinic_location_id
       AND location.id = $2::uuid
       AND location.clinic_id = $3::uuid
       AND location.status = 'ACTIVE'
      JOIN clinic_schema.clinics clinic
        ON clinic.id = location.clinic_id
       AND clinic.status = 'ACTIVE'
      WHERE membership.employee_id = $1::uuid
        AND membership.active = true
        AND membership.revoked_at IS NULL
    `, [employee.sub, locationId, clinicId]);
    if (!authority.rows[0]) throw DomainErrors.clinicScopeMismatch();
    return { serverNow: authority.rows[0].server_now, timezone: authority.rows[0].timezone };
  }
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

  async assertBookingDecisionAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, {
      actor: employee,
      capability: Capability.BOOKING_DECISION,
      resource: { aggregateType: 'booking.decision', clinicId, locationId: clinicLocationId },
    });
    await this.assertExactClinicLocationMembership(client, employee, clinicId, clinicLocationId);
  }

  assertBookingDecisionCapability(employee: JwtPayload): void {
    if (!hasCapability(employee, Capability.BOOKING_DECISION)) throw DomainErrors.clinicScopeMismatch();
  }

  async assertAppointmentRegistryReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.APPOINTMENT_REGISTRY_READ, resource: { aggregateType: 'appointment.registry', clinicId, locationId: clinicLocationId } });
  }

  async assertPatientRegistryReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.PATIENT_ADMIN_READ, resource: { aggregateType: 'patient.registry', clinicId, locationId: clinicLocationId } });
  }

  async assertPatientLocalProfileUpdateAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, {
      actor: employee,
      capability: Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE,
      resource: { aggregateType: 'patient.local-profile', clinicId, locationId: clinicLocationId },
    });
  }

  async assertQualityReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (!featureFlags.QUALITY_READ_CAPABILITY_V1) return this.assertLocationAccess(client, employee, clinicLocationId);
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.QUALITY_READ, resource: { aggregateType: 'quality.dashboard', clinicId, locationId: clinicLocationId } });
  }

  async assertScheduleReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    if (featureFlags.SCHEDULE_READ_CAPABILITY_V1) {
      await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.SCHEDULE_READ, resource: { aggregateType: 'schedule.slots', clinicId, locationId: clinicLocationId } });
    } else if (!employee.roles.some((role) => role === Role.CLINIC_ADMIN || role === Role.CLINIC_RECEPTIONIST || role === Role.CLINIC_VETERINARIAN)) {
      throw DomainErrors.clinicScopeMismatch();
    }
    await this.assertExactClinicLocationMembership(client, employee, clinicId, clinicLocationId);
  }

  async assertScheduleManageAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.SCHEDULE_MANAGE, resource: { aggregateType: 'schedule.inventory', clinicId, locationId: clinicLocationId } });
    await this.assertExactClinicLocationMembership(client, employee, clinicId, clinicLocationId);
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
    clinicId: string,
    clinicLocationId: string,
  ): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.CLINICAL_VISIT_COMPLETE, resource: { aggregateType: 'clinical.visit', clinicId, locationId: clinicLocationId } });
  }

  async assertClinicalVisitWorkspaceReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, clinicLocationId: string): Promise<void> {
    await this.capabilities.assertAllowed(client, { actor: employee, capability: Capability.CLINICAL_VISIT_WORKSPACE_READ, resource: { aggregateType: 'clinical.visit.workspace', clinicId, locationId: clinicLocationId } });
  }
}
