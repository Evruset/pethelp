import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainErrors } from '../common/domain-error';
import { JwtPayload } from './auth.types';
import { Capability, CapabilityResource, hasCapability } from './capability';
import { TELEMED_INTAKE_CATEGORIES } from '../modules/telemed/dto/create-telemed-intake.dto';

const TELEMED_AUDIT_TRAIL_DATA_CATEGORIES = new Set([
  'GENERAL_QUESTION', 'SKIN_EAR_EYE', 'NUTRITION', 'BEHAVIOR', 'MEDICATION_QUESTION', 'POST_VISIT_FOLLOW_UP',
]);

/** Server-side deny-by-default evaluator. JWT scopes are early rejects only. */
@Injectable()
export class CapabilityEvaluatorService {
  private readonly logger = new Logger(CapabilityEvaluatorService.name);

  async assertAllowed(client: PoolClient, input: { actor: JwtPayload; capability: Capability; resource: CapabilityResource }): Promise<void> {
    const { actor, capability, resource } = input;
    if (!hasCapability(actor, capability)) return this.deny('capability');
    if (resource.aggregateType === 'telemed.vet.audit-trail') {
      if (resource.assignedEmployeeId !== actor.sub) return this.deny('assignment');
      if (!TELEMED_INTAKE_CATEGORIES.includes(resource.dataCategory as typeof TELEMED_INTAKE_CATEGORIES[number]) || !TELEMED_AUDIT_TRAIL_DATA_CATEGORIES.has(resource.dataCategory)) return this.deny('data-category');
      return;
    }
    if (resource.aggregateType === 'telemed.vet.queue' || resource.aggregateType === 'ops.slo.snapshot') return;
    if (!actor.locationIds?.includes(resource.locationId)) return this.deny('location-scope');
    if (resource.clinicId && !actor.clinicIds?.includes(resource.clinicId)) return this.deny('clinic-scope');

    const membership = await client.query<{ employee_id: string }>(`
      SELECT employee_id FROM clinic_schema.employee_location_memberships
      WHERE employee_id = $1::uuid AND clinic_location_id = $2::uuid AND active = true
      FOR SHARE
    `, [actor.sub, resource.locationId]);
    if (!membership.rows[0]) return this.deny('inactive-membership');
  }

  private deny(reason: 'capability' | 'location-scope' | 'clinic-scope' | 'inactive-membership' | 'assignment' | 'data-category'): never {
    this.logger.warn(`capability_denied reason=${reason}`);
    throw DomainErrors.clinicScopeMismatch();
  }
}
