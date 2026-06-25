import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';

export type OwnerAppointmentSummary = {
  holdId: string;
  appointmentId: string | null;
  state: string;
  startsAt: string;
  endsAt: string;
  clinic: { id: string; name: string; address: string };
  pet: { id: string; name: string; species: string };
};

@Injectable()
export class OwnerAppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload): Promise<OwnerAppointmentSummary[]> {
    const result = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      starts_at: Date;
      ends_at: Date;
      clinic_id: string;
      clinic_name: string;
      address: string;
      pet_id: string;
      pet_name: string;
      pet_species: string;
    }>(`
      SELECT
        hold.id AS hold_id,
        appointment.id AS appointment_id,
        COALESCE(appointment.status, hold.state) AS state,
        slot.starts_at,
        slot.ends_at,
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        location.address,
        pet.id AS pet_id,
        pet.name AS pet_name,
        pet.species AS pet_species
      FROM booking_schema.booking_holds hold
      JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      JOIN pet_schema.pets pet ON pet.id = hold.pet_id
      LEFT JOIN booking_schema.appointments appointment ON appointment.hold_id = hold.id
      WHERE hold.owner_id = $1::uuid
      ORDER BY slot.starts_at DESC, hold.created_at DESC
      LIMIT 100
    `, [owner.sub]);

    return result.rows.map((row) => ({
      holdId: row.hold_id,
      appointmentId: row.appointment_id,
      state: row.state,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      clinic: { id: row.clinic_id, name: row.clinic_name, address: row.address },
      pet: { id: row.pet_id, name: row.pet_name, species: row.pet_species },
    }));
  }
}
