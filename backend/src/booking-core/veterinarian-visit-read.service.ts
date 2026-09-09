import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

export type VeterinarianVisitView = { holdId: string; clinicId: string; locationId: string; scheduledStart: string; scheduledEnd: string; status: string; petDisplayName: string; species: string };
export type VeterinarianVisitDetailView = VeterinarianVisitView & {
  visitId: string | null;
};
@Injectable()
export class VeterinarianVisitReadService {
  constructor(private readonly database: DatabaseService, private readonly access: ClinicEmployeeAccessService) {}
  async list(clinicId: string, locationId: string, employee: JwtPayload): Promise<VeterinarianVisitView[]> {
    return this.database.withTransaction(async (client) => {
      await this.access.assertClinicalVisitWorkspaceReadAccess(client, employee, clinicId, locationId);
      const result = await client.query<VeterinarianVisitRow>(`
        SELECT h.id::text AS hold_id, l.clinic_id::text AS clinic_id,
               s.clinic_location_id::text AS location_id, s.starts_at, s.ends_at,
               h.state, p.name AS pet_name, p.species
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations l ON l.id = s.clinic_location_id
        JOIN pet_schema.pets p ON p.id = h.pet_id
        WHERE l.clinic_id = $1::uuid
          AND s.clinic_location_id = $2::uuid
          AND h.state IN ('CONFIRMED', 'COMPLETED')
        ORDER BY s.starts_at
      `, [clinicId, locationId]);
      return result.rows.map(toView);
    });
  }

  async detail(clinicId: string, locationId: string, holdId: string, employee: JwtPayload): Promise<VeterinarianVisitDetailView> {
    return this.database.withTransaction(async (client) => {
      await this.access.assertClinicalVisitWorkspaceReadAccess(client, employee, clinicId, locationId);
      const result = await client.query<VeterinarianVisitDetailRow>(`
        SELECT h.id::text AS hold_id, l.clinic_id::text AS clinic_id,
               s.clinic_location_id::text AS location_id, s.starts_at, s.ends_at,
               h.state, p.name AS pet_name, p.species,
               v.id::text AS visit_id
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations l ON l.id = s.clinic_location_id
        JOIN pet_schema.pets p ON p.id = h.pet_id
        LEFT JOIN clinical_schema.visits v
          ON v.booking_hold_id = h.id
         AND v.owner_id = h.owner_id
         AND v.pet_id = h.pet_id
         AND v.clinic_id = l.clinic_id
         AND v.location_id = s.clinic_location_id
         AND v.slot_id = h.slot_id
        WHERE h.id = $1::uuid
          AND l.clinic_id = $2::uuid
          AND s.clinic_location_id = $3::uuid
          AND h.state IN ('CONFIRMED', 'COMPLETED')
      `, [holdId, clinicId, locationId]);
      if (!result.rows[0]) throw DomainErrors.clinicScopeMismatch();
      return {
        ...toView(result.rows[0]),
        visitId: result.rows[0].visit_id,
      };
    });
  }
}

type VeterinarianVisitRow = {
  hold_id: string; clinic_id: string; location_id: string; starts_at: Date; ends_at: Date;
  state: 'CONFIRMED' | 'COMPLETED'; pet_name: string; species: string;
};
type VeterinarianVisitDetailRow = VeterinarianVisitRow & {
  visit_id: string | null;
};

function toView(row: VeterinarianVisitRow): VeterinarianVisitView {
  return {
    holdId: row.hold_id,
    clinicId: row.clinic_id,
    locationId: row.location_id,
    scheduledStart: row.starts_at.toISOString(),
    scheduledEnd: row.ends_at.toISOString(),
    status: row.state,
    petDisplayName: row.pet_name,
    species: row.species,
  };
}
