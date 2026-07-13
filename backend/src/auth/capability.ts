import { JwtPayload, Role } from './auth.types';

/**
 * Stable authorization vocabulary for business actions. Roles are identity
 * attributes; application services authorize capabilities plus resource scope.
 */
export enum Capability {
  CLINICAL_VISIT_COMPLETE = 'clinical.visit.complete',
  CLINICAL_VISIT_WORKSPACE_READ = 'clinical.visit.workspace.read',
  BOOKING_QUEUE_READ = 'booking.queue.read',
  QUALITY_READ = 'quality.read',
  SCHEDULE_READ = 'schedule.read',
  BOOKING_REPLAY_READ = 'booking.replay.read',
  BOOKING_HOLD_READ = 'booking.hold.read',
  TELEMED_VET_QUEUE_READ = 'telemed.vet.queue.read',
  TELEMED_VET_AUDIT_TRAIL_READ = 'telemed.vet.audit-trail.read',
  OPS_SLO_SNAPSHOT_READ = 'ops.slo.snapshot.read',
}

const ROLE_CAPABILITIES: Readonly<Partial<Record<Role, readonly Capability[]>>> = {
  [Role.CLINIC_VETERINARIAN]: [Capability.CLINICAL_VISIT_COMPLETE, Capability.CLINICAL_VISIT_WORKSPACE_READ],
  [Role.CLINIC_RECEPTIONIST]: [Capability.BOOKING_QUEUE_READ, Capability.QUALITY_READ, Capability.SCHEDULE_READ, Capability.BOOKING_REPLAY_READ, Capability.BOOKING_HOLD_READ],
  [Role.CLINIC_ADMIN]: [Capability.BOOKING_QUEUE_READ, Capability.QUALITY_READ, Capability.SCHEDULE_READ, Capability.BOOKING_REPLAY_READ, Capability.BOOKING_HOLD_READ],
  [Role.TELEMED_VETERINARIAN]: [Capability.TELEMED_VET_QUEUE_READ, Capability.TELEMED_VET_AUDIT_TRAIL_READ],
  [Role.PLATFORM_ADMIN]: [Capability.OPS_SLO_SNAPSHOT_READ],
  [Role.SECURITY_AUDITOR]: [Capability.OPS_SLO_SNAPSHOT_READ],
};

export type CapabilityResource = {
  aggregateType: 'booking.queue' | 'booking.hold' | 'booking.hold.replay' | 'clinical.visit' | 'clinical.visit.workspace' | 'quality.dashboard' | 'schedule.slots';
  clinicId?: string;
  locationId: string;
} | {
  aggregateType: 'telemed.vet.queue';
} | {
  aggregateType: 'telemed.vet.audit-trail';
  authorityModel: 'platform-assignment';
  assignedEmployeeId: string | null;
  dataCategory: string;
} | {
  aggregateType: 'ops.slo.snapshot';
  authorityModel: 'platform';
};

export function hasCapability(employee: JwtPayload, capability: Capability): boolean {
  return employee.roles.some((role) => ROLE_CAPABILITIES[role]?.includes(capability) ?? false);
}

export function effectiveCapabilities(employee: JwtPayload): Capability[] {
  return [...new Set(employee.roles.flatMap((role) => ROLE_CAPABILITIES[role] ?? []))];
}
