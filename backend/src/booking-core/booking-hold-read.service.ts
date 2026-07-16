import { Injectable } from '@nestjs/common';
import { JwtPayload, Role } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

type Summary = { id: string; name: string };

export interface HoldView {
  holdId: string;
  slotId: string;
  state: string;
  statusCode: string;
  statusTitle: string;
  safeDescription: string;
  nextActionCode: 'WAIT' | 'VIEW_APPOINTMENT' | 'CHOOSE_ANOTHER_SLOT';
  confirmationMode: 'AUTOMATIC' | 'MANUAL' | 'MIS';
  expiresAt: string;
  serverNow: string;
  aggregateVersion: number;
  lastUpdatedAt: string;
  pet: Summary & { species: string };
  clinic: Summary;
  location: { id: string; address: string };
  service: Summary;
  doctor: Summary | null;
  slot: { startsAt: string; endsAt: string; timezone: string };
  clinicLocationId: string;
  startsAt: string;
  endsAt: string;
}

const STATUS: Record<string, { title: string; description: string; next: HoldView['nextActionCode'] }> = {
  MANUAL_CONFIRM_PENDING: { title: 'Клиника подтверждает заявку', description: 'Ожидаем подтверждение выбранного времени клиникой.', next: 'WAIT' },
  MIS_RESERVATION_PENDING: { title: 'Проверяем время в расписании клиники', description: 'Сверяем выбранное время с расписанием клиники.', next: 'WAIT' },
  MIS_RECONCILIATION_PENDING: { title: 'Проверяем время в расписании клиники', description: 'Уточняем итоговый статус заявки.', next: 'WAIT' },
  MIS_HELD: { title: 'Клиника подтверждает заявку', description: 'Время удерживается, ожидаем окончательное подтверждение.', next: 'WAIT' },
  CONFIRMED: { title: 'Запись подтверждена', description: 'Клиника подтвердила выбранное время.', next: 'VIEW_APPOINTMENT' },
  MIS_BOOKING_FAILED: { title: 'Клиника не смогла подтвердить это время', description: 'Выберите другое доступное время.', next: 'CHOOSE_ANOTHER_SLOT' },
  SLA_BREACHED: { title: 'Клиника не ответила вовремя', description: 'Выберите другое доступное время.', next: 'CHOOSE_ANOTHER_SLOT' },
  EXPIRED: { title: 'Время ожидания истекло', description: 'Проверьте актуальные свободные интервалы.', next: 'CHOOSE_ANOTHER_SLOT' },
  RELEASED: { title: 'Заявка больше не активна', description: 'Проверьте актуальные свободные интервалы.', next: 'CHOOSE_ANOTHER_SLOT' },
};

@Injectable()
export class BookingHoldReadService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async readForActor(holdId: string, actor: JwtPayload): Promise<HoldView> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const result = await client.query<{
        hold_id: string; owner_id: string; slot_id: string; state: string; expires_at: Date;
        hold_version: number; updated_at: Date; server_now: Date; clinic_location_id: string;
        clinic_id: string; clinic_name: string; clinic_timezone: string; location_address: string;
        starts_at: Date; ends_at: Date; integration_mode: string; pet_id: string; pet_name: string;
        pet_species: string; service_id: string; service_name: string; doctor_id: string | null;
        doctor_name: string | null;
      }>(`
        SELECT h.id::text AS hold_id, h.owner_id::text, h.slot_id::text, h.state, h.expires_at,
               h.version AS hold_version, h.updated_at, clock_timestamp() AS server_now,
               s.clinic_location_id::text, location.clinic_id::text, clinic.public_name AS clinic_name,
               clinic.timezone AS clinic_timezone, location.address AS location_address,
               s.starts_at, s.ends_at, s.integration_mode,
               pet.id::text AS pet_id, pet.name AS pet_name, pet.species AS pet_species,
               service.id::text AS service_id, service.display_name AS service_name,
               doctor.id::text AS doctor_id, doctor.full_name AS doctor_name
        FROM booking_schema.booking_holds h
        JOIN clinic_schema.appointment_slots s ON s.id = h.slot_id
        JOIN clinic_schema.clinic_locations location ON location.id = s.clinic_location_id
        JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
        JOIN pet_schema.pets pet ON pet.id = h.pet_id
        JOIN clinic_schema.clinic_services service ON service.id = s.service_id
        LEFT JOIN catalog_schema.doctors doctor ON doctor.id = s.doctor_id
        WHERE h.id = $1::uuid
        FOR SHARE OF h, s
      `, [holdId]);
      const hold = result.rows[0];
      if (!hold) throw DomainErrors.holdNotFound();

      if (actor.roles.includes(Role.OWNER)) {
        if (hold.owner_id !== actor.sub) throw DomainErrors.holdNotFound();
      } else if (!actor.roles.includes(Role.SYSTEM_WORKER)) {
        await this.clinicAccess.assertBookingHoldReadAccess(client, actor, hold.clinic_id, hold.clinic_location_id);
      }

      const status = STATUS[hold.state] ?? { title: 'Проверяем статус заявки', description: 'Получаем актуальный статус от клиники.', next: 'WAIT' as const };
      const confirmationMode = hold.integration_mode === 'LEVEL_C'
        ? (hold.state === 'CONFIRMED' ? 'AUTOMATIC' : 'MANUAL')
        : 'MIS';
      return {
        holdId: hold.hold_id,
        slotId: hold.slot_id,
        state: hold.state,
        statusCode: hold.state,
        statusTitle: status.title,
        safeDescription: status.description,
        nextActionCode: status.next,
        confirmationMode,
        expiresAt: hold.expires_at.toISOString(),
        serverNow: hold.server_now.toISOString(),
        aggregateVersion: hold.hold_version,
        lastUpdatedAt: hold.updated_at.toISOString(),
        pet: { id: hold.pet_id, name: hold.pet_name, species: hold.pet_species },
        clinic: { id: hold.clinic_id, name: hold.clinic_name },
        location: { id: hold.clinic_location_id, address: hold.location_address },
        service: { id: hold.service_id, name: hold.service_name },
        doctor: hold.doctor_id && hold.doctor_name ? { id: hold.doctor_id, name: hold.doctor_name } : null,
        slot: { startsAt: hold.starts_at.toISOString(), endsAt: hold.ends_at.toISOString(), timezone: hold.clinic_timezone },
        clinicLocationId: hold.clinic_location_id,
        startsAt: hold.starts_at.toISOString(),
        endsAt: hold.ends_at.toISOString(),
      };
    });
  }
}
