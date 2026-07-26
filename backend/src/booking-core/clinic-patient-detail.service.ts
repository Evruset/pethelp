import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPatientAppointmentSummaryDto, ClinicPatientDetailDto } from './dto/clinic-patient-detail.dto';

type AppointmentRow = {
  appointmentId: unknown; startsAt: unknown; endsAt: unknown; statusCode: unknown;
  serviceName: unknown; veterinarianName: unknown;
};
type DetailRow = {
  patient_id: unknown; display_name: unknown; species: unknown; breed: unknown; sex: unknown;
  birth_date: unknown; first_seen_at: unknown; last_seen_at: unknown;
  last_appointment: unknown; next_appointment: unknown; recent_appointments: unknown;
  local_alias: unknown; local_administrative_reference: unknown;
  local_aggregate_version: unknown; local_updated_at: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPECIES: Record<string, string> = { CAT: 'Кошка', DOG: 'Собака' };
const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована', COMPLETED: 'Завершена', NO_SHOW: 'Неявка',
  CANCELLED: 'Отменена', UNKNOWN: 'Статус не определён',
};
const notFound = (): never => { throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' }); };

export const CLINIC_PATIENT_DETAIL_SQL = `
  WITH visible AS MATERIALIZED (
    SELECT a.pet_id,a.first_qualified_at,a.last_qualified_at
    FROM clinic_schema.clinic_patient_associations a
    JOIN clinic_schema.clinic_patient_consents c
      ON c.id=a.current_consent_id AND c.clinic_id=$1::uuid
     AND c.clinic_location_id=$2::uuid AND c.pet_id=$3::uuid
    WHERE a.clinic_id=$1::uuid AND a.clinic_location_id=$2::uuid AND a.pet_id=$3::uuid
      AND a.status='ACTIVE' AND a.revoked_at IS NULL AND a.archived_at IS NULL
      AND a.visibility_policy_version=$4 AND a.visibility_expires_at > $5::timestamptz
      AND c.purpose='PATIENT_ADMIN_REGISTRY' AND c.revoked_at IS NULL
      AND c.granted_at <= $5::timestamptz AND (c.expires_at IS NULL OR c.expires_at > $5::timestamptz)
    LIMIT 1
  ), appointment_projection AS MATERIALIZED (
    SELECT a.id::text AS "appointmentId",s.starts_at AS "startsAt",s.ends_at AS "endsAt",
      CASE
        WHEN a.status='COMPLETED' THEN 'COMPLETED'
        WHEN a.status='NO_SHOW' THEN 'NO_SHOW'
        WHEN a.status IN ('CLINIC_CANCELLED','CANCELLED') THEN 'CANCELLED'
        WHEN a.status IN ('CONFIRMED','SCHEDULED','MANUAL_CONFIRM_PENDING') THEN 'SCHEDULED'
        ELSE 'UNKNOWN'
      END AS "statusCode",
      service.display_name AS "serviceName",staff.display_name AS "veterinarianName"
    FROM visible v
    JOIN booking_schema.appointments a ON a.pet_id=v.pet_id AND a.clinic_location_id=$2::uuid
    JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id AND s.clinic_location_id=$2::uuid
    LEFT JOIN clinic_schema.clinic_services service
      ON service.id=s.service_id AND service.clinic_location_id=$2::uuid
    LEFT JOIN clinic_schema.clinic_staff staff
      ON staff.id=s.staff_id AND staff.clinic_location_id=$2::uuid
  )
  SELECT p.id::text AS patient_id,p.name AS display_name,p.species,p.breed,p.sex,p.birth_date,
    v.first_qualified_at AS first_seen_at,v.last_qualified_at AS last_seen_at,
    local_profile.alias AS local_alias,
    local_profile.administrative_reference AS local_administrative_reference,
    COALESCE(local_profile.aggregate_version,0)::integer AS local_aggregate_version,
    local_profile.updated_at AS local_updated_at,
    (SELECT to_jsonb(x) FROM (
      SELECT * FROM appointment_projection WHERE "startsAt" <= $5::timestamptz
      ORDER BY "startsAt" DESC,"appointmentId" DESC LIMIT 1
    ) x) AS last_appointment,
    (SELECT to_jsonb(x) FROM (
      SELECT * FROM appointment_projection
      WHERE "startsAt" > $5::timestamptz AND "statusCode" NOT IN ('CANCELLED','COMPLETED','NO_SHOW')
      ORDER BY "startsAt" ASC,"appointmentId" ASC LIMIT 1
    ) x) AS next_appointment,
    COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."startsAt" DESC,x."appointmentId" DESC)
      FROM (SELECT * FROM appointment_projection WHERE "startsAt" <= $5::timestamptz
        ORDER BY "startsAt" DESC,"appointmentId" DESC LIMIT 10) x),'[]'::jsonb) AS recent_appointments
  FROM visible v
  JOIN pet_schema.pets p ON p.id=v.pet_id AND p.archived_at IS NULL
  LEFT JOIN clinic_schema.clinic_patient_local_profiles local_profile
    ON local_profile.clinic_id=$1::uuid
   AND local_profile.clinic_location_id=$2::uuid
   AND local_profile.patient_id=$3::uuid
`;

@Injectable()
export class ClinicPatientDetailService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async detail(input: {
    clinicId: string; locationId: string; patientId: string; employee: JwtPayload;
  }): Promise<ClinicPatientDetailDto> {
    const policyVersion = this.policyVersion();
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '750ms'");
      if (!input.employee.clinicIds?.includes(input.clinicId)) throw DomainErrors.clinicScopeMismatch();
      await this.clinicAccess.assertPatientRegistryReadAccess(client, input.employee, input.clinicId, input.locationId);
      await this.assertLocation(client, input.clinicId, input.locationId);
      const serverNow = await this.dbNow(client);
      const result = await client.query<DetailRow>(
        CLINIC_PATIENT_DETAIL_SQL,
        [input.clinicId, input.locationId, input.patientId, policyVersion, serverNow],
      );
      const row = result.rows[0];
      if (!row) return notFound();
      return this.toDto(input, serverNow, row);
    });
  }

  private policyVersion(): string {
    const version = process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION?.trim();
    const days = Number(process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS);
    if (!version || !Number.isInteger(days) || days <= 0) {
      throw new ServiceUnavailableException({
        code: 'PATIENT_DETAIL_POLICY_UNAVAILABLE', message: 'Patient detail policy unavailable',
      });
    }
    return version;
  }

  private async assertLocation(client: PoolClient, clinicId: string, locationId: string): Promise<void> {
    const location = await client.query(
      `SELECT 1 FROM clinic_schema.clinic_locations
       WHERE id=$1::uuid AND clinic_id=$2::uuid AND status='ACTIVE'`,
      [locationId, clinicId],
    );
    if (!location.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT statement_timestamp() AS now');
    const value = result.rows[0]?.now;
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error('Invalid patient detail time');
    return value;
  }

  private toDto(
    input: { clinicId: string; locationId: string; patientId: string },
    serverNow: Date,
    row: DetailRow,
  ): ClinicPatientDetailDto {
    if (typeof row.patient_id !== 'string' || !UUID.test(row.patient_id) || row.patient_id !== input.patientId
      || typeof row.display_name !== 'string' || row.display_name.trim() === ''
      || typeof row.species !== 'string' || row.species.trim() === ''
      || (row.breed !== null && typeof row.breed !== 'string')
      || (row.sex !== null && !['MALE', 'FEMALE', 'UNKNOWN'].includes(String(row.sex)))
      || !(row.first_seen_at instanceof Date) || !Number.isFinite(row.first_seen_at.getTime())
      || !(row.last_seen_at instanceof Date) || !Number.isFinite(row.last_seen_at.getTime())
      || !(row.local_alias === null || typeof row.local_alias === 'string')
      || !(row.local_administrative_reference === null || typeof row.local_administrative_reference === 'string')
      || !Number.isInteger(row.local_aggregate_version) || Number(row.local_aggregate_version) < 0
      || (Number(row.local_aggregate_version) === 0
        ? row.local_alias !== null || row.local_administrative_reference !== null || row.local_updated_at !== null
        : !(row.local_updated_at instanceof Date) || !Number.isFinite(row.local_updated_at.getTime()))) {
      throw new Error('Invalid patient detail row');
    }
    const recent = this.appointments(row.recent_appointments);
    if (recent.length > 10 || new Set(recent.map((item) => item.appointmentId)).size !== recent.length) {
      throw new Error('Invalid patient detail appointments');
    }
    return {
      clinicId: input.clinicId,
      locationId: input.locationId,
      serverNow: serverNow.toISOString(),
      patient: {
        patientId: row.patient_id,
        pet: {
          displayName: row.display_name,
          speciesLabel: SPECIES[row.species] ?? row.species,
          breed: row.breed as string | null,
          sexCode: row.sex as 'MALE' | 'FEMALE' | 'UNKNOWN' | null,
          birthDate: row.birth_date === null ? null : this.dateOnly(row.birth_date),
        },
        owner: { displayName: null },
        relationship: {
          firstSeenAt: row.first_seen_at.toISOString(),
          lastSeenAt: row.last_seen_at.toISOString(),
        },
        appointments: {
          last: row.last_appointment === null ? null : this.appointment(row.last_appointment),
          next: row.next_appointment === null ? null : this.appointment(row.next_appointment),
          recent,
        },
        localProfile: {
          alias: row.local_alias as string | null,
          administrativeReference: row.local_administrative_reference as string | null,
          aggregateVersion: Number(row.local_aggregate_version),
          updatedAt: row.local_updated_at === null ? null : (row.local_updated_at as Date).toISOString(),
        },
      },
    };
  }

  private appointments(value: unknown): ClinicPatientAppointmentSummaryDto[] {
    if (!Array.isArray(value)) throw new Error('Invalid patient detail appointments');
    return value.map((item) => this.appointment(item));
  }

  private appointment(value: unknown): ClinicPatientAppointmentSummaryDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid patient detail appointment');
    const row = value as AppointmentRow;
    const status = typeof row.statusCode === 'string' && STATUS_LABELS[row.statusCode] ? row.statusCode : null;
    if (typeof row.appointmentId !== 'string' || !UUID.test(row.appointmentId) || !status
      || (row.serviceName !== null && typeof row.serviceName !== 'string')
      || (row.veterinarianName !== null && typeof row.veterinarianName !== 'string')) {
      throw new Error('Invalid patient detail appointment');
    }
    return {
      appointmentId: row.appointmentId,
      startsAt: this.timestamp(row.startsAt),
      endsAt: this.timestamp(row.endsAt),
      statusCode: status,
      statusLabel: STATUS_LABELS[status],
      service: { displayName: row.serviceName as string | null },
      veterinarian: { displayName: row.veterinarianName as string | null },
    };
  }

  private timestamp(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Invalid patient detail timestamp');
    }
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|\+00:00)$/.exec(value);
    if (!match) throw new Error('Invalid patient detail timestamp');
    const millisecondsPart = (match[2] ?? '').padEnd(3, '0').slice(0, 3);
    const canonical = `${match[1]}.${millisecondsPart}Z`;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== canonical) {
      throw new Error('Invalid patient detail timestamp');
    }
    return new Date(milliseconds).toISOString();
  }

  private dateOnly(value: unknown): string {
    const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid patient detail birth date');
    }
    return date;
  }
}
