import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';

export type OwnerAppointmentPresentation = {
  code:
    | 'WAITING_FOR_CLINIC'
    | 'CHECKING_AVAILABILITY'
    | 'ALTERNATIVE_TIME_REQUIRED'
    | 'CONFIRMED_UPCOMING'
    | 'VISIT_TIME_PASSED'
    | 'NOT_CONFIRMED'
    | 'CANCELLED'
    | 'HISTORY_RECORDED'
    | 'STATUS_SYNCING';
  label: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
};

export type OwnerAppointmentSummary = {
  holdId: string;
  appointmentId: string | null;
  state: string;
  bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY';
  presentation: OwnerAppointmentPresentation;
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
  timeline: Array<{
    at: string;
    type: string;
    label: string;
    occurredAt: string;
    code: string;
    title: string;
    description: string;
    isCurrent: boolean;
  }>;
  actions: {
    canRefresh: boolean;
    canRebook: true;
    canOpenRoute: boolean;
    canReviewAlternative: boolean;
    canCancel: boolean;
  };
  cancellation: {
    canCancel: boolean;
    cancellationPolicyCode: 'ACTIVE_HOLD_RELEASE_V1' | 'CLINIC_CONFIRMATION_REQUIRED_V1';
    cancellationDeadlineAt: null;
    safeReason: string | null;
    aggregateVersion: number;
  };
};

/**
 * Maps an authoritative aggregate state to copy that is safe for an owner.
 * The client must render this object directly and must not infer a completed
 * visit from a device clock.
 */
export function ownerAppointmentPresentation(
  state: string,
  bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY',
): OwnerAppointmentPresentation {
  if (bucket === 'HISTORY' && state === 'CONFIRMED') {
    return {
      code: 'VISIT_TIME_PASSED',
      label: 'Время визита прошло',
      description:
        'Клиника пока не передала отметку о фактическом визите. Детали записи сохранены в истории.',
      tone: 'neutral',
    };
  }

  switch (state) {
    case 'MANUAL_CONFIRM_PENDING':
      return {
        code: 'WAITING_FOR_CLINIC',
        label: 'Ожидаем подтверждения',
        description: 'Клиника проверяет возможность записи.',
        tone: 'info',
      };
    case 'MIS_RESERVATION_PENDING':
    case 'MIS_RECONCILIATION_PENDING':
    case 'MIS_HELD':
      return {
        code: 'CHECKING_AVAILABILITY',
        label: 'Проверяем время',
        description: 'VetHelp сверяет выбранное окно с клиникой.',
        tone: 'info',
      };
    case 'ALTERNATIVE_PENDING':
      return {
        code: 'ALTERNATIVE_TIME_REQUIRED',
        label: 'Нужно выбрать время',
        description: 'Клиника предложила другое доступное время.',
        tone: 'warning',
      };
    case 'CONFIRMED':
      return {
        code: 'CONFIRMED_UPCOMING',
        label: 'Подтверждена',
        description: 'Клиника подтвердила визит.',
        tone: 'success',
      };
    case 'CANCELLATION_REQUESTED':
      return {
        code: 'STATUS_SYNCING',
        label: 'Запрошена отмена',
        description: 'Менеджер поддержки свяжется с клиникой и подтвердит результат.',
        tone: 'warning',
      };
    case 'RESCHEDULE_REQUESTED':
      return {
        code: 'STATUS_SYNCING',
        label: 'Запрошен перенос',
        description: 'Клиника подберёт другое время и обновит запись.',
        tone: 'warning',
      };
    case 'COMPLETED':
      return {
        code: 'HISTORY_RECORDED',
        label: 'Приём завершён',
        description: 'Заключение врача сохранено в истории питомца.',
        tone: 'success',
      };
    case 'EXPIRED':
    case 'SLA_BREACHED':
      return {
        code: 'NOT_CONFIRMED',
        label: 'Не подтверждена',
        description: 'Клиника не успела подтвердить заявку.',
        tone: 'warning',
      };
    case 'RELEASED':
    case 'MIS_BOOKING_FAILED':
      return {
        code: 'CANCELLED',
        label: 'Отменена',
        description: 'Это время больше недоступно.',
        tone: 'danger',
      };
    default:
      return bucket === 'HISTORY'
          ? {
              code: 'HISTORY_RECORDED',
              label: 'Запись завершена',
              description: 'Событие сохранено в истории записи.',
              tone: 'neutral',
            }
          : {
              code: 'STATUS_SYNCING',
              label: 'Проверяем статус',
              description: 'VetHelp получает актуальные данные от клиники.',
              tone: 'info',
            };
  }
}

@Injectable()
export class OwnerAppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload, limit = 100): Promise<OwnerAppointmentSummary[]> {
    const result = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY';
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
        hold.state AS state,
        CASE
          WHEN hold.state = 'ALTERNATIVE_PENDING' AND slot.ends_at > server_time.value THEN 'REQUIRES_ACTION'
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN hold.state IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED',
            'CANCELLATION_REQUESTED',
            'RESCHEDULE_REQUESTED'
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
          WHEN hold.state = 'ALTERNATIVE_PENDING' AND slot.ends_at > server_time.value THEN 0
          WHEN slot.ends_at <= server_time.value THEN 1
          WHEN hold.state IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED',
            'CANCELLATION_REQUESTED',
            'RESCHEDULE_REQUESTED'
          ) THEN 1
          ELSE 2
        END ASC,
        CASE WHEN hold.state = 'ALTERNATIVE_PENDING' THEN COALESCE(hold.alternative_expires_at, hold.expires_at) END ASC,
        CASE WHEN slot.ends_at > server_time.value THEN slot.starts_at END ASC,
        CASE WHEN slot.ends_at <= server_time.value THEN hold.state_changed_at END DESC,
        hold.id ASC
      LIMIT $2
    `,
      [owner.sub, limit],
    );

    return result.rows.map((row) => ({
      holdId: row.hold_id,
      appointmentId: row.appointment_id,
      state: row.state,
      bucket: row.bucket,
      presentation: ownerAppointmentPresentation(row.state, row.bucket),
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

  async listV50(owner: JwtPayload, input: { bucket?: string; petId?: string; cursor?: string; limit: number }) {
    const rows = await this.list(owner, 1000);
    const filtered = rows.filter((row) => (!input.petId || row.pet.id === input.petId) && (!input.bucket || row.bucket === input.bucket));
    const cursorIndex = input.cursor ? filtered.findIndex((row) => row.holdId === input.cursor) : -1;
    if (input.cursor && cursorIndex < 0) {
      throw new BadRequestException({ code: 'INVALID_BOOKING_CURSOR', message: 'Cursor is not valid for this booking query.' });
    }
    const start = cursorIndex + 1;
    const page = filtered.slice(start, start + input.limit);
    const now = await this.database.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return {
      serverNow: now.rows[0].now.toISOString(),
      requiresAction: page.filter((row) => row.bucket === 'REQUIRES_ACTION'),
      active: page.filter((row) => row.bucket === 'ACTIVE'),
      history: page.filter((row) => row.bucket === 'HISTORY'),
      nextCursor: start + input.limit < filtered.length ? page.at(-1)?.holdId ?? null : null,
    };
  }

  async read(
    owner: JwtPayload,
    holdId: string,
  ): Promise<OwnerAppointmentDetail | undefined> {
    const result = await this.database.query<{
      hold_id: string;
      appointment_id: string | null;
      state: string;
      bucket: 'REQUIRES_ACTION' | 'ACTIVE' | 'HISTORY';
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
        hold.state AS state,
        CASE
          WHEN hold.state = 'ALTERNATIVE_PENDING' AND slot.ends_at > server_time.value THEN 'REQUIRES_ACTION'
          WHEN slot.ends_at <= server_time.value THEN 'HISTORY'
          WHEN hold.state IN (
            'MANUAL_CONFIRM_PENDING',
            'MIS_RESERVATION_PENDING',
            'MIS_RECONCILIATION_PENDING',
            'MIS_HELD',
            'ALTERNATIVE_PENDING',
            'CONFIRMED',
            'CANCELLATION_REQUESTED',
            'RESCHEDULE_REQUESTED'
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
    const presentation = ownerAppointmentPresentation(row.state, row.bucket);
    return {
      holdId: row.hold_id,
      appointmentId: row.appointment_id,
      state: row.state,
      bucket: row.bucket,
      presentation,
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
        canRefresh: row.bucket === 'ACTIVE',
        canRebook: true,
        canOpenRoute: Boolean(
          (row.latitude && row.longitude) || row.address?.trim(),
        ),
        canReviewAlternative:
            row.bucket === 'ACTIVE' && row.state === 'ALTERNATIVE_PENDING',
        canCancel:
            row.bucket === 'ACTIVE' &&
            [
              'MANUAL_CONFIRM_PENDING',
              'ALTERNATIVE_PENDING',
              'MIS_RESERVATION_PENDING',
              'MIS_RECONCILIATION_PENDING',
              'MIS_HELD',
              'CONFIRMED',
            ].includes(row.state),
      },
      cancellation: {
        canCancel: row.bucket !== 'HISTORY' && ['MANUAL_CONFIRM_PENDING', 'ALTERNATIVE_PENDING', 'MIS_RESERVATION_PENDING', 'MIS_RECONCILIATION_PENDING', 'MIS_HELD', 'CONFIRMED'].includes(row.state),
        cancellationPolicyCode: row.state === 'CONFIRMED' ? 'CLINIC_CONFIRMATION_REQUIRED_V1' : 'ACTIVE_HOLD_RELEASE_V1',
        cancellationDeadlineAt: null,
        safeReason: row.bucket === 'HISTORY' ? 'Запись уже завершена.' : null,
        aggregateVersion: row.version,
      },
    };
  }

  private async timeline(
    holdId: string,
  ): Promise<OwnerAppointmentDetail['timeline']> {
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
               WHEN 'booking.cancellation_requested' THEN 'Запрошена отмена'
               WHEN 'booking.expired' THEN 'Срок заявки истёк'
               ELSE 'Статус записи обновлён'
             END AS label
      FROM audit_schema.audit_log audit
      WHERE audit.aggregate_type = 'booking_hold'
        AND audit.aggregate_id = $1::uuid
        AND audit.action = ANY(ARRAY['booking.hold.created','mis.reservation.held','booking.confirmed','BOOKING_ALTERNATIVE_PROPOSED','booking.released','booking.hold.released','booking.cancellation_requested','booking.expired','booking.hold.expired'])
      UNION ALL
      SELECT event.occurred_at AS at, event.event_type AS type,
             CASE event.event_type
               WHEN 'booking.confirmed' THEN 'Создана подтверждённая запись'
               ELSE 'Статус записи обновлён'
             END AS label
      FROM booking_schema.appointment_events event
      WHERE event.hold_id = $1::uuid
        AND event.event_type = ANY(ARRAY['booking.confirmed'])
      ORDER BY at ASC
      LIMIT 30
    `,
      [holdId],
    );
    return result.rows.map((row, index) => ({
      at: row.at.toISOString(),
      type: row.type,
      label: row.label,
      occurredAt: row.at.toISOString(),
      code: publicTimelineCode(row.type),
      title: row.label,
      description: publicTimelineDescription(row.type),
      isCurrent: index === result.rows.length - 1,
    }));
  }
}

function publicTimelineCode(type: string): string {
  const codes: Record<string, string> = {
    'booking.hold.created': 'REQUEST_CREATED',
    'mis.reservation.held': 'TIME_HELD',
    'booking.confirmed': 'BOOKING_CONFIRMED',
    BOOKING_ALTERNATIVE_PROPOSED: 'ACTION_REQUIRED',
    'booking.released': 'BOOKING_RELEASED',
    'booking.hold.released': 'BOOKING_RELEASED',
    'booking.cancellation_requested': 'CANCELLATION_REQUESTED',
    'booking.expired': 'BOOKING_EXPIRED',
    'booking.hold.expired': 'BOOKING_EXPIRED',
  };
  return codes[type] ?? 'STATUS_UPDATED';
}

function publicTimelineDescription(type: string): string {
  return type === 'booking.cancellation_requested'
      ? 'Клиника должна подтвердить итог отмены.'
      : 'Статус подтверждён сервером VetHelp.';
}
