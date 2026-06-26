import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';

export type OwnerAppointmentSummary = {
  holdId: string;
  appointmentId: string | null;
  state: string;
  bucket: 'ACTIVE' | 'HISTORY';
  startsAt: string;
  endsAt: string;
  clinic: { id: string; name: string; address: string };
  pet: { id: string; name: string; species: string };
};

export type OwnerAppointmentDetail = OwnerAppointmentSummary & {
  version: number;
  expiresAt: string;
  latestStatusUpdateAt: string;
  serverNow: string;
  service: {
    id: string | null;
    code: string | null;
    name: string | null;
    priceAmount: string | null;
    currency: string | null;
  };
  location: {
    id: string;
    address: string;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  timeline: Array<{ at: string; type: string; label: string }>;
  actions: {
    canRefresh: true;
    canRebook: true;
    canOpenRoute: boolean;
    canReviewAlternative: boolean;
    canCancel: boolean;
  };
};

@Injectable()
export class OwnerAppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload): Promise<OwnerAppointmentSummary[]> {
    const result = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      bucket: 'ACTIVE' | 'HISTORY';
      starts_at: Date;
      ends_at: Date;
      clinic_id: string;
      clinic_name: string;
      address: string;
      pet_id: string;
      pet_name: string;
      pet_species: string;
    }>(
      `
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        hold.id AS hold_id,
        appointment.id AS appointment_id,
        COALESCE(appointment.status, hold.state) AS state,
        CASE
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN COALESCE(appointment.status, hold.state) IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED'
          ) THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
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
      CROSS JOIN server_time
      WHERE hold.owner_id = $1::uuid
      ORDER BY
        CASE
          WHEN slot.ends_at <= server_time.value THEN 1
          WHEN COALESCE(appointment.status, hold.state) IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED'
          ) THEN 0
          ELSE 1
        END ASC,
        slot.starts_at DESC,
        hold.created_at DESC
      LIMIT 100
    `,
      [owner.sub],
    );

    return result.rows.map((row) => ({
      holdId: row.hold_id,
      appointmentId: row.appointment_id,
      state: row.state,
      bucket: row.bucket,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      clinic: {
        id: row.clinic_id,
        name: row.clinic_name,
        address: row.address,
      },
      pet: { id: row.pet_id, name: row.pet_name, species: row.pet_species },
    }));
  }

  async read(
    owner: JwtPayload,
    holdId: string,
  ): Promise<OwnerAppointmentDetail | undefined> {
    const result = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      bucket: 'ACTIVE' | 'HISTORY';
      version: number;
      expires_at: Date;
      state_changed_at: Date;
      starts_at: Date;
      ends_at: Date;
      clinic_id: string;
      clinic_name: string;
      location_id: string;
      address: string;
      phone: string | null;
      latitude: number | string | null;
      longitude: number | string | null;
      service_id: string | null;
      service_code: string | null;
      service_name: string | null;
      price_amount: string | null;
      currency: string | null;
      pet_id: string;
      pet_name: string;
      pet_species: string;
      server_now: Date;
    }>(
      `
      WITH server_time AS (SELECT clock_timestamp() AS value)
      SELECT
        hold.id AS hold_id,
        appointment.id AS appointment_id,
        COALESCE(appointment.status, hold.state) AS state,
        CASE
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN COALESCE(appointment.status, hold.state) IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED'
          ) THEN 'ACTIVE'
          ELSE 'HISTORY'
        END AS bucket,
        hold.version,
        hold.expires_at,
        hold.state_changed_at,
        slot.starts_at,
        slot.ends_at,
        clinic.id AS clinic_id,
        clinic.public_name AS clinic_name,
        location.id AS location_id,
        location.address,
        location.phone,
        location.latitude,
        location.longitude,
        service.id AS service_id,
        service.code AS service_code,
        service.display_name AS service_name,
        service.price_amount::text AS price_amount,
        service.currency,
        pet.id AS pet_id,
        pet.name AS pet_name,
        pet.species AS pet_species,
        server_time.value AS server_now
      FROM booking_schema.booking_holds hold
      JOIN clinic_schema.appointment_slots slot ON slot.id = hold.slot_id
      JOIN clinic_schema.clinic_locations location ON location.id = slot.clinic_location_id
      JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
      JOIN pet_schema.pets pet ON pet.id = hold.pet_id
      LEFT JOIN clinic_schema.clinic_services service ON service.id = slot.service_id
      LEFT JOIN booking_schema.appointments appointment ON appointment.hold_id = hold.id
      CROSS JOIN server_time
      WHERE hold.owner_id = $1::uuid
        AND hold.id = $2::uuid
      LIMIT 1
    `,
      [owner.sub, holdId],
    );

    const row = result.rows[0];
    if (!row) return undefined;
    const timeline = await this.timeline(row.hold_id);
    return {
      holdId: row.hold_id,
      appointmentId: row.appointment_id,
      state: row.state,
      bucket: row.bucket,
      version: row.version,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      latestStatusUpdateAt: row.state_changed_at.toISOString(),
      serverNow: row.server_now.toISOString(),
      clinic: {
        id: row.clinic_id,
        name: row.clinic_name,
        address: row.address,
      },
      location: {
        id: row.location_id,
        address: row.address,
        phone: row.phone,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      },
      service: {
        id: row.service_id,
        code: row.service_code,
        name: row.service_name,
        priceAmount: row.price_amount,
        currency: row.currency,
      },
      pet: { id: row.pet_id, name: row.pet_name, species: row.pet_species },
      timeline,
      actions: {
        canRefresh: true,
        canRebook: true,
        canOpenRoute: Boolean(row.latitude && row.longitude),
        canReviewAlternative: row.state === 'ALTERNATIVE_PENDING',
        canCancel: [
          'MANUAL_CONFIRM_PENDING',
          'MIS_RESERVATION_PENDING',
          'MIS_RECONCILIATION_PENDING',
          'MIS_HELD',
          'CONFIRMED',
        ].includes(row.state),
      },
    };
  }

  private async timeline(
    holdId: string,
  ): Promise<Array<{ at: string; type: string; label: string }>> {
    const result = await this.database.query<{
      at: Date;
      type: string;
      label: string;
    }>(
      `
      SELECT hold.created_at AS at, 'booking.hold.created' AS type, 'Заявка создана' AS label
      FROM booking_schema.booking_holds hold
      WHERE hold.id = $1::uuid
      UNION ALL
      SELECT audit.occurred_at AS at, audit.action AS type,
             CASE audit.action
               WHEN 'booking.hold.created' THEN 'Заявка отправлена'
               WHEN 'mis.reservation.held' THEN 'Время удержано в клинике'
               WHEN 'booking.confirmed' THEN 'Запись подтверждена'
               WHEN 'BOOKING_ALTERNATIVE_PROPOSED' THEN 'Клиника предложила другое время'
               WHEN 'booking.released' THEN 'Заявка отменена'
               WHEN 'booking.expired' THEN 'Срок заявки истёк'
               ELSE audit.action
             END AS label
      FROM audit_schema.audit_log audit
      WHERE audit.aggregate_type = 'booking_hold'
        AND audit.aggregate_id = $1::uuid
      UNION ALL
      SELECT event.occurred_at AS at, event.event_type AS type,
             CASE event.event_type
               WHEN 'booking.confirmed' THEN 'Создана подтверждённая запись'
               ELSE event.event_type
             END AS label
      FROM booking_schema.appointment_events event
      WHERE event.hold_id = $1::uuid
      ORDER BY at ASC
      LIMIT 30
    `,
      [holdId],
    );
    return result.rows.map((row) => ({
      at: row.at.toISOString(),
      type: row.type,
      label: row.label,
    }));
  }
}
