import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

interface SlotRow {
  id: string;
  starts_at: Date;
  ends_at: Date;
  service_name: string | null;
}

export interface ClinicAvailableSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string | null;
}

export interface ClinicAvailableSlotsResult {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: ClinicAvailableSlot[];
}

@Injectable()
export class ClinicAvailableSlotsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async list(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    excludedSlotId?: string;
    limit: number;
  }): Promise<ClinicAvailableSlotsResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) {
        throw DomainErrors.clinicScopeMismatch();
      }
      await this.clinicAccess.assertLocationAccess(client, input.employee, input.locationId);
      await this.assertLocationBelongsToClinic(client, input.clinicId, input.locationId);

      const server = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const result = await client.query<SlotRow>(`
        SELECT s.id, s.starts_at, s.ends_at, cs.display_name AS service_name
        FROM clinic_schema.appointment_slots s
        LEFT JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
        WHERE s.clinic_location_id = $1::uuid
          AND s.state = 'OPEN'
          AND s.status = 'AVAILABLE'
          AND s.starts_at > clock_timestamp()
          AND s.capacity - s.booked_count - s.held_count > 0
          AND ($2::uuid IS NULL OR s.id <> $2::uuid)
        ORDER BY s.starts_at ASC, s.id ASC
        LIMIT $3
      `, [input.locationId, input.excludedSlotId ?? null, input.limit]);

      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: server.rows[0].now.toISOString(),
        items: result.rows.map((slot) => ({
          id: slot.id,
          startsAt: slot.starts_at.toISOString(),
          endsAt: slot.ends_at.toISOString(),
          serviceName: slot.service_name,
        })),
      };
    });
  }

  private async assertLocationBelongsToClinic(
    client: PoolClient,
    clinicId: string,
    locationId: string,
  ): Promise<void> {
    const location = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.clinic_locations
      WHERE id = $1::uuid AND clinic_id = $2::uuid AND status = 'ACTIVE'
      FOR SHARE
    `, [locationId, clinicId]);
    if (!location.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }
}
