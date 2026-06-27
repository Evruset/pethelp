import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TelemedSessionState } from './telemed.service';

export interface OwnerTelemedSessionSnapshot {
  sessionId: string;
  state: TelemedSessionState;
  telemedCaseState: string | null;
  paymentStatus: string | null;
  refundState: string | null;
  doctorJoinDeadlineAt: string;
  serverNow: string;
  version: number;
}

export interface OwnerTelemedSessionSummary {
  sessionId: string;
  bookingHoldId: string | null;
  telemedCaseId: string | null;
  state: TelemedSessionState;
  telemedCaseState: string | null;
  paymentStatus: string | null;
  refundState: string | null;
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
      booking_hold_id: string | null;
      telemed_case_id: string | null;
      state: TelemedSessionState;
      telemed_case_state: string | null;
      payment_status: string | null;
      refund_state: string | null;
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
        session.telemed_case_id::text AS telemed_case_id,
        session.state,
        telemed_case.state AS telemed_case_state,
        telemed_payment.status AS payment_status,
        CASE
          WHEN telemed_payment.status IN ('VOID_REQUESTED', 'VOIDED', 'REFUND_PENDING', 'REFUNDED')
            THEN telemed_payment.status
          WHEN telemed_case.state = 'EXPIRED_NO_DOCTOR' AND telemed_payment.id IS NULL
            THEN 'NOT_REQUIRED'
          ELSE NULL
        END AS refund_state,
        CASE
          WHEN session.state IN ('WAITING_FOR_DOCTOR', 'CONNECTED') THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
        COALESCE(slot.starts_at, session.created_at) AS starts_at,
        COALESCE(slot.ends_at, session.expires_at) AS ends_at,
        session.expires_at,
        server_time.value AS server_now,
        session.version,
        COALESCE(clinic.id::text, 'telemed') AS clinic_id,
        COALESCE(clinic.public_name, 'VetHelp Telemed') AS clinic_name,
        COALESCE(location.address, 'Онлайн-консультация') AS address,
        pet.id::text AS pet_id,
        pet.name AS pet_name,
        pet.species AS pet_species,
        service.id::text AS service_id,
        service.display_name AS service_name
      FROM telemed_schema.telemed_sessions session
      LEFT JOIN booking_schema.booking_holds hold ON hold.id = session.booking_hold_id
      LEFT JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = session.telemed_case_id
      LEFT JOIN telemed_schema.telemed_payment_intents telemed_payment ON telemed_payment.case_id = telemed_case.id
      LEFT JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      LEFT JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      LEFT JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      JOIN pet_schema.pets pet ON pet.id = COALESCE(hold.pet_id, telemed_case.pet_id)
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
      telemedCaseId: row.telemed_case_id,
      state: row.state,
      telemedCaseState: row.telemed_case_state,
      paymentStatus: row.payment_status,
      refundState: row.refund_state,
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
      telemed_case_state: string | null;
      payment_status: string | null;
      refund_state: string | null;
      expires_at: Date;
      server_now: Date;
      version: number;
    }>(`
      SELECT
        session.id::text AS id,
        session.state,
        telemed_case.state AS telemed_case_state,
        telemed_payment.status AS payment_status,
        CASE
          WHEN telemed_payment.status IN ('VOID_REQUESTED', 'VOIDED', 'REFUND_PENDING', 'REFUNDED')
            THEN telemed_payment.status
          WHEN telemed_case.state = 'EXPIRED_NO_DOCTOR' AND telemed_payment.id IS NULL
            THEN 'NOT_REQUIRED'
          ELSE NULL
        END AS refund_state,
        session.expires_at,
        clock_timestamp() AS server_now,
        session.version
      FROM telemed_schema.telemed_sessions session
      LEFT JOIN telemed_schema.telemed_cases telemed_case ON telemed_case.id = session.telemed_case_id
      LEFT JOIN telemed_schema.telemed_payment_intents telemed_payment ON telemed_payment.case_id = telemed_case.id
      WHERE session.id = $1::uuid
        AND session.owner_id = $2::uuid
    `, [sessionId, ownerId]);
    const row = result.rows[0];
    if (!row) {
      throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
    }
    return {
      sessionId: row.id,
      state: row.state,
      telemedCaseState: row.telemed_case_state,
      paymentStatus: row.payment_status,
      refundState: row.refund_state,
      doctorJoinDeadlineAt: row.expires_at.toISOString(),
      serverNow: row.server_now.toISOString(),
      version: row.version,
    };
  }
}
