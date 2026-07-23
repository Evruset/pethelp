import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicAppointmentDetailDto } from './dto/clinic-appointment-detail.dto';

export type AppointmentRegistryBucket = 'upcoming' | 'history';

type CursorPayload = {
  v: 1;
  clinicId: string;
  locationId: string;
  bucket: AppointmentRegistryBucket;
  limit: number;
  snapshotAt: string;
  sortAt: string;
  appointmentId: string;
};

type RegistryRow = {
  appointment_id: string;
  appointment_version: number;
  appointment_status: string;
  slot_starts_at: Date;
  slot_starts_cursor: string;
  slot_ends_at: Date;
  pet_id: string;
  pet_name: string;
  pet_species: string;
  service_name: string | null;
};

type DetailRow = {
  appointment_id: string;
  appointment_version: number;
  appointment_status: string;
  appointment_created_at: Date;
  slot_starts_at: Date;
  slot_ends_at: Date;
  slot_source: string;
  timezone: string;
  pet_id: string;
  pet_name: string;
  pet_species: string;
  service_name: string | null;
  veterinarian_name: string | null;
  resource_name: string | null;
};

type DetailStatusCode = AppointmentRegistryItem['statusCode'] | 'UNKNOWN';

export type AppointmentRegistryItem = {
  appointmentId: string;
  aggregateVersion: number;
  statusCode: 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  statusLabel: string;
  slot: { startsAt: string; endsAt: string };
  pet: { id: string; name: string; speciesLabel: string };
  service: { displayName: string } | null;
};

export type AppointmentRegistryResult = {
  clinicId: string;
  locationId: string;
  serverNow: string;
  items: AppointmentRegistryItem[];
  nextCursor: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_STATUSES = ['COMPLETED', 'NO_SHOW', 'CLINIC_CANCELLED', 'CANCELLED'] as const;
const SPECIES_LABELS: Record<string, string> = { CAT: 'Кошка', DOG: 'Собака' };
const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Вручную',
  MIS: 'МИС клиники',
  IMPORT: 'Импорт',
};

@Injectable()
export class ClinicAppointmentsRegistryService {
  private readonly cursorSecret = createHmac('sha256', config.jwtSecret)
    .update('clinic-appointments-registry-cursor:v1')
    .digest();

  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async list(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    bucket: AppointmentRegistryBucket;
    limit: number;
    cursor?: string;
  }): Promise<AppointmentRegistryResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '500ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) throw DomainErrors.clinicScopeMismatch();
      await this.clinicAccess.assertAppointmentRegistryReadAccess(client, input.employee, input.clinicId, input.locationId);
      await this.assertLocationBelongsToClinic(client, input.clinicId, input.locationId);

      const serverNow = await this.dbNow(client);
      const cursor = input.cursor ? this.decodeCursor(input.cursor, input) : undefined;
      const snapshotAt = cursor?.snapshotAt ?? serverNow.raw;
      const result = await this.query(client, input, snapshotAt, cursor);
      const hasMore = result.rows.length > input.limit;
      const rows = result.rows.slice(0, input.limit);
      const tail = rows.at(-1);

      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: serverNow.date.toISOString(),
        items: rows.map((row) => this.toItem(row)),
        nextCursor: hasMore && tail ? this.encodeCursor({
          v: 1,
          clinicId: input.clinicId,
          locationId: input.locationId,
          bucket: input.bucket,
          limit: input.limit,
          snapshotAt,
          sortAt: tail.slot_starts_cursor,
          appointmentId: tail.appointment_id,
        }) : null,
      };
    });
  }

  async detail(input: {
    clinicId: string;
    locationId: string;
    appointmentId: string;
    employee: JwtPayload;
  }): Promise<ClinicAppointmentDetailDto> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '500ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) throw DomainErrors.clinicScopeMismatch();
      await this.clinicAccess.assertAppointmentRegistryReadAccess(client, input.employee, input.clinicId, input.locationId);
      await this.assertLocationBelongsToClinic(client, input.clinicId, input.locationId);

      const [serverNow, result] = await Promise.all([
        this.dbNow(client),
        client.query<DetailRow>(`
          SELECT a.id AS appointment_id, a.version AS appointment_version,
                 a.status AS appointment_status, a.created_at AS appointment_created_at,
                 s.starts_at AS slot_starts_at, s.ends_at AS slot_ends_at,
                 s.source AS slot_source, clinic.timezone,
                 p.id AS pet_id, p.name AS pet_name, p.species AS pet_species,
                 service.display_name AS service_name,
                 staff.display_name AS veterinarian_name,
                 resource.display_name AS resource_name
          FROM booking_schema.appointments a
          JOIN clinic_schema.appointment_slots s
            ON s.id = a.slot_id AND s.clinic_location_id = $2::uuid
          JOIN clinic_schema.clinic_locations location
            ON location.id = s.clinic_location_id
             AND location.id = $2::uuid
             AND location.clinic_id = $1::uuid
             AND location.status = 'ACTIVE'
          JOIN clinic_schema.clinics clinic ON clinic.id = location.clinic_id
          JOIN pet_schema.pets p ON p.id = a.pet_id
          LEFT JOIN clinic_schema.clinic_services service
            ON service.id = s.service_id AND service.clinic_location_id = $2::uuid
          LEFT JOIN clinic_schema.clinic_staff staff
            ON staff.id = s.staff_id AND staff.clinic_location_id = $2::uuid
          LEFT JOIN clinic_schema.clinic_resources resource
            ON resource.id = s.resource_id AND resource.clinic_location_id = $2::uuid
          WHERE a.id = $3::uuid
            AND a.clinic_location_id = $2::uuid
          LIMIT 1
        `, [input.clinicId, input.locationId, input.appointmentId]),
      ]);
      const row = result.rows[0];
      if (!row) throw DomainErrors.clinicScopeMismatch();
      const status = this.detailStatus(row.appointment_status);
      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: serverNow.date.toISOString(),
        appointment: {
          appointmentId: row.appointment_id,
          aggregateVersion: row.appointment_version,
          statusCode: status.code,
          statusLabel: status.label,
          createdAt: strictIsoTimestamp(row.appointment_created_at),
        },
        schedule: {
          startsAt: strictIsoTimestamp(row.slot_starts_at),
          endsAt: strictIsoTimestamp(row.slot_ends_at),
          timezone: row.timezone,
          sourceLabel: SOURCE_LABELS[row.slot_source.toUpperCase()] ?? 'Источник не указан',
        },
        owner: null,
        pet: {
          id: row.pet_id,
          displayName: row.pet_name,
          speciesLabel: SPECIES_LABELS[row.pet_species.toUpperCase()] ?? 'Другой вид',
        },
        service: row.service_name ? { displayName: row.service_name } : null,
        veterinarian: row.veterinarian_name ? { displayName: row.veterinarian_name } : null,
        resource: row.resource_name ? { displayName: row.resource_name } : null,
        availableActions: [],
      };
    });
  }

  private query(client: PoolClient, input: { locationId: string; bucket: AppointmentRegistryBucket; limit: number }, snapshotAt: string, cursor?: CursorPayload) {
    const history = input.bucket === 'history';
    const terminal = TERMINAL_STATUSES.map((_, index) => `$${index + 6}`).join(', ');
    return client.query<RegistryRow>(`
      SELECT a.id AS appointment_id, a.version AS appointment_version,
             a.status AS appointment_status,
             s.starts_at AS slot_starts_at, s.starts_at::text AS slot_starts_cursor,
             s.ends_at AS slot_ends_at,
             p.id AS pet_id, p.name AS pet_name, p.species AS pet_species,
             cs.display_name AS service_name
      FROM booking_schema.appointments a
      JOIN clinic_schema.appointment_slots s ON s.id = a.slot_id
      JOIN pet_schema.pets p ON p.id = a.pet_id
      LEFT JOIN clinic_schema.clinic_services cs ON cs.id = s.service_id
      WHERE a.clinic_location_id = $1::uuid
        AND s.clinic_location_id = $1::uuid
        AND a.created_at <= $2::timestamptz
        AND (${history
          ? `(a.status IN (${terminal}) OR (a.status NOT IN (${terminal}) AND s.ends_at < $2::timestamptz))`
          : `(a.status NOT IN (${terminal}) AND s.ends_at >= $2::timestamptz)`})
        AND ($3::timestamptz IS NULL OR ${history
          ? `(s.starts_at, a.id) < ($3::timestamptz, $4::uuid)`
          : `(s.starts_at, a.id) > ($3::timestamptz, $4::uuid)`})
      ORDER BY s.starts_at ${history ? 'DESC' : 'ASC'}, a.id ${history ? 'DESC' : 'ASC'}
      LIMIT $5
    `, [input.locationId, snapshotAt, cursor?.sortAt ?? null, cursor?.appointmentId ?? null, input.limit + 1, ...TERMINAL_STATUSES]);
  }

  private encodeCursor(payload: CursorPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.cursorSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private decodeCursor(encoded: string, input: { clinicId: string; locationId: string; bucket: AppointmentRegistryBucket; limit: number }): CursorPayload {
    try {
      const [body, signature, extra] = encoded.split('.');
      if (!body || !signature || extra) throw new Error();
      const expected = createHmac('sha256', this.cursorSecret).update(body).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CursorPayload;
      if (payload.v !== 1 || payload.clinicId !== input.clinicId || payload.locationId !== input.locationId
        || payload.bucket !== input.bucket || payload.limit !== input.limit || !UUID.test(payload.appointmentId)
        || !this.validTimestamp(payload.snapshotAt) || !this.validTimestamp(payload.sortAt)) throw new Error();
      return payload;
    } catch {
      throw new BadRequestException({ code: 'INVALID_APPOINTMENT_REGISTRY_CURSOR', message: 'Invalid cursor' });
    }
  }

  private validTimestamp(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
  }

  private toItem(row: RegistryRow): AppointmentRegistryItem {
    const status = this.publicStatus(row.appointment_status);
    return {
      appointmentId: row.appointment_id,
      aggregateVersion: row.appointment_version,
      statusCode: status.code,
      statusLabel: status.label,
      slot: { startsAt: row.slot_starts_at.toISOString(), endsAt: row.slot_ends_at.toISOString() },
      pet: { id: row.pet_id, name: row.pet_name, speciesLabel: SPECIES_LABELS[row.pet_species.toUpperCase()] ?? 'Другой вид' },
      service: row.service_name ? { displayName: row.service_name } : null,
    };
  }

  private publicStatus(status: string): { code: AppointmentRegistryItem['statusCode']; label: string } {
    if (status === 'COMPLETED') return { code: 'COMPLETED', label: 'Завершена' };
    if (status === 'NO_SHOW') return { code: 'NO_SHOW', label: 'Неявка' };
    if (status === 'CLINIC_CANCELLED' || status === 'CANCELLED') return { code: 'CANCELLED', label: 'Отменена' };
    return { code: 'SCHEDULED', label: 'Запланирована' };
  }

  private detailStatus(status: string): { code: DetailStatusCode; label: string } {
    if (status === 'CONFIRMED') return { code: 'SCHEDULED', label: 'Запланирована' };
    if (status === 'COMPLETED') return { code: 'COMPLETED', label: 'Завершена' };
    if (status === 'NO_SHOW') return { code: 'NO_SHOW', label: 'Неявка' };
    if (status === 'CLINIC_CANCELLED' || status === 'CANCELLED') return { code: 'CANCELLED', label: 'Отменена' };
    return { code: 'UNKNOWN', label: 'Статус уточняется' };
  }

  private async assertLocationBelongsToClinic(client: PoolClient, clinicId: string, locationId: string): Promise<void> {
    const result = await client.query(`
      SELECT id FROM clinic_schema.clinic_locations
      WHERE id = $1::uuid AND clinic_id = $2::uuid AND status = 'ACTIVE'
      FOR SHARE
    `, [locationId, clinicId]);
    if (!result.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }

  private async dbNow(client: PoolClient): Promise<{ raw: string; date: Date }> {
    const result = await client.query<{ raw: string; date: Date }>('SELECT clock_timestamp()::text AS raw, clock_timestamp() AS date');
    return result.rows[0];
  }
}

const STRICT_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

export function strictIsoTimestamp(value: Date | string): string {
  const source = value instanceof Date ? value.toISOString() : value;
  const match = STRICT_INSTANT.exec(source);
  if (!match) throw new Error('Malformed appointment timestamp');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) throw new Error('Malformed appointment timestamp');
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) throw new Error('Malformed appointment timestamp');
  const parsed = new Date(source);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Malformed appointment timestamp');
  return parsed.toISOString();
}
