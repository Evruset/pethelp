import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TelemedSessionState } from './telemed.service';

export interface OwnerTelemedSessionSnapshot {
  sessionId: string;
  state: TelemedSessionState;
  doctorJoinDeadlineAt: string;
  serverNow: string;
  version: number;
}

export interface OwnerTelemedSessionSummary {
  sessionId: string;
  bookingHoldId: string;
  state: TelemedSessionState;
  bucket: 'ACTIVE' | 'HISTORY';
  startsAt: string;
  endsAt: string;
  doctorJoinDeadlineAt: string;
  serverNow: string;
  version: number;
  clinic: { id: string; name: string; address: string };
  pet: { id: string; name: string; species: string };
  service: { id: string | null; name: string | null };
}

@Injectable()
export class TelemedOwnerSessionService {
  constructor(private readonly database: DatabaseService) {}

  async list(ownerId: string): Promise<OwnerTelemedSessionSummary[]> {
    const result = await this.database.query<{
      session_id: string;
      booking_hold_id: string;
      state: TelemedSessionState;
      bucket: 'ACTIVE' | 'HISTORY';
      starts_at: Date;
      ends_at: Date;
      expires_at: Date;
      server_now: Date;
      version: number;
      clinic_id: string;
      clinic_name: string;
      address: string;
      pet_id: string;
      pet_name: string;
      pet_species: string;
      service_id: string | null;
      service_name: string | null;
    }>(`
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        session.id::text AS session_id,
        session.booking_hold_id::text AS booking_hold_id,
        session.state,
        CASE
          WHEN session.state IN ('WAITING_FOR_DOCTOR', 'CONNECTED') THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
        slot.starts_at,
        slot.ends_at,
        session.expires_at,
        server_time.value AS server_now,
        session.version,
        clinic.id::text AS clinic_id,
        clinic.public_name AS clinic_name,
        location.address,
        pet.id::text AS pet_id,
        pet.name AS pet_name,
        pet.species AS pet_species,
        service.id::text AS service_id,
        service.display_name AS service_name
      FROM telemed_schema.telemed_sessions session
      JOIN booking_schema.booking_holds hold ON hold.id = session.booking_hold_id
      JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      JOIN pet_schema.pets pet ON pet.id = hold.pet_id
      LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
      CROSS JOIN server_time
      WHERE session.owner_id = $1::uuid
      ORDER BY
        CASE WHEN session.state IN ('WAITING_FOR_DOCTOR', 'CONNECTED') THEN 0 ELSE 1 END,
        session.created_at DESC
      LIMIT 100
    `, [ownerId]);

    return result.rows.map((row) => ({
      sessionId: row.session_id,
      bookingHoldId: row.booking_hold_id,
      state: row.state,
      bucket: row.bucket,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      doctorJoinDeadlineAt: row.expires_at.toISOString(),
      serverNow: row.server_now.toISOString(),
      version: row.version,
      clinic: {
        id: row.clinic_id,
        name: row.clinic_name,
        address: row.address,
      },
      pet: {
        id: row.pet_id,
        name: row.pet_name,
        species: row.pet_species,
      },
      service: {
        id: row.service_id,
        name: row.service_name,
      },
    }));
  }

  async read(sessionId: string, ownerId: string): Promise<OwnerTelemedSessionSnapshot> {
    const result = await this.database.query<{
      id: string;
      state: TelemedSessionState;
      expires_at: Date;
      server_now: Date;
      version: number;
    }>(`
      SELECT
        id::text,
        state,
        expires_at,
        clock_timestamp() AS server_now,
        version
      FROM telemed_schema.telemed_sessions
      WHERE id = $1::uuid
        AND owner_id = $2::uuid
    `, [sessionId, ownerId]);
    const row = result.rows[0];
    if (!row) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
    }
    return {
      sessionId: row.id,
      state: row.state,
      doctorJoinDeadlineAt: row.expires_at.toISOString(),
      serverNow: row.server_now.toISOString(),
      version: row.version,
    };
  }
}
