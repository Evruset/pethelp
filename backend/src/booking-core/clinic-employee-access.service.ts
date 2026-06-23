import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';

/**
 * Database-backed ABAC enforcement for clinic portal commands. JWT location
 * claims are an early reject only; the active membership row remains the
 * authoritative source inside the same transaction as the state change.
 */
@Injectable()
export class ClinicEmployeeAccessService {
  async assertLocationAccess(client: PoolClient, employee: JwtPayload, clinicLocationId: string): Promise<void> {
    if (!employee.roles.includes(Role.CLINIC_RECEPTIONIST) && !employee.roles.includes(Role.CLINIC_ADMIN)) {
      throw DomainErrors.clinicScopeMismatch();
    }
    if (!employee.locationIds?.includes(clinicLocationId)) {
      throw DomainErrors.clinicScopeMismatch();
    }

    const membership = await client.query<{ employee_id: string }>(`
      SELECT employee_id
      FROM clinic_schema.employee_location_memberships
      WHERE employee_id = $1::uuid
        AND clinic_location_id = $2::uuid
        AND active = true
      FOR SHARE
    `, [employee.sub, clinicLocationId]);

    if (!membership.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }
}
