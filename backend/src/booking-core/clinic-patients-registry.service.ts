import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPatientsRegistryDto } from './dto/clinic-patients-registry.dto';

type Cursor = {
  v: 1; clinicId: string; locationId: string; q: string | null; limit: number;
  snapshotSequence: string; lastSeenAt: string; patientId: string;
};

type RegistryRow = {
  patient_id: string; display_name: string; species: string; breed: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null; birth_date: string | Date | null;
  first_seen_at: Date; last_seen_at: Date; last_visit_at: Date | null;
  next_appointment_at: Date | null;
};

type RateBucket = { count: number; resetAt: number };

const SPECIES: Record<string, string> = { CAT: 'Кошка', DOG: 'Собака' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PatientsRegistryRateLimitException extends HttpException {
  constructor(readonly retryAfter: number) {
    super({ code: 'PATIENTS_REGISTRY_SEARCH_RATE_LIMITED', message: 'Search rate limit exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class ClinicPatientsRegistryService {
  private readonly cursorSecret = createHmac('sha256', config.jwtSecret).update('clinic-patients-registry-cursor:v1').digest();
  private readonly searchBuckets = new Map<string, RateBucket>();

  constructor(private readonly database: DatabaseService, private readonly clinicAccess: ClinicEmployeeAccessService) {}

  async list(input: { clinicId: string; locationId: string; employee: JwtPayload; q?: string; limit: number; cursor?: string }): Promise<ClinicPatientsRegistryDto> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '750ms'");
      await this.clinicAccess.assertPatientRegistryReadAccess(client, input.employee, input.clinicId, input.locationId);
      await this.assertLocation(client, input.clinicId, input.locationId);
      const cursor = input.cursor ? this.decode(input.cursor, input) : undefined;
      const policyVersion = this.visibilityPolicyVersion();
      if (input.q) this.consumeSearch(input, this.searchPolicy());

      const now = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const snapshotSequence = cursor?.snapshotSequence ?? await this.snapshot(client, input);
      const result = await this.query(client, input, policyVersion, now.rows[0].now, snapshotSequence, cursor);
      const hasMore = result.rows.length > input.limit;
      const rows = result.rows.slice(0, input.limit);
      const tail = rows.at(-1);
      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: now.rows[0].now.toISOString(),
        items: rows.map((row) => this.toItem(row)),
        nextCursor: hasMore && tail ? this.encode({
          v: 1, clinicId: input.clinicId, locationId: input.locationId, q: input.q ?? null,
          limit: input.limit, snapshotSequence, lastSeenAt: tail.last_seen_at.toISOString(), patientId: tail.patient_id,
        }) : null,
      };
    });
  }

  private visibilityPolicyVersion(): string {
    const version = process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION?.trim();
    const daysRaw = process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS ?? '';
    const days = Number(daysRaw);
    if (!version || !/^\d+$/.test(daysRaw) || !Number.isInteger(days) || days < 1 || days > 3650) {
      throw new ServiceUnavailableException({ code: 'PATIENTS_REGISTRY_POLICY_UNAVAILABLE', message: 'Patients registry policy unavailable' });
    }
    return version;
  }

  private searchPolicy(): { searchLimit: number; searchWindowSeconds: number } {
    const searchLimit = Number(process.env.VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT);
    const searchWindowSeconds = Number(process.env.VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS);
    // No shared limiter primitive exists in the current repository. The
    // bounded process-local implementation is test/local only and must never
    // silently become a bypass across production replicas.
    if (process.env.NODE_ENV === 'production'
      || !Number.isInteger(searchLimit) || searchLimit <= 0
      || !Number.isInteger(searchWindowSeconds) || searchWindowSeconds <= 0) {
      throw new ServiceUnavailableException({ code: 'PATIENTS_REGISTRY_POLICY_UNAVAILABLE', message: 'Patients registry policy unavailable' });
    }
    return { searchLimit, searchWindowSeconds };
  }

  private consumeSearch(input: { clinicId: string; locationId: string; employee: JwtPayload }, policy: { searchLimit: number; searchWindowSeconds: number }): void {
    const key = `${input.employee.sub}:${input.clinicId}:${input.locationId}`;
    const now = Date.now();
    if (this.searchBuckets.size >= 10_000) {
      for (const [candidate, value] of this.searchBuckets) {
        if (value.resetAt <= now) this.searchBuckets.delete(candidate);
      }
      if (this.searchBuckets.size >= 10_000 && !this.searchBuckets.has(key)) {
        throw new ServiceUnavailableException({ code: 'PATIENTS_REGISTRY_POLICY_UNAVAILABLE', message: 'Patients registry policy unavailable' });
      }
    }
    let bucket = this.searchBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + policy.searchWindowSeconds * 1000 };
    if (bucket.count >= policy.searchLimit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new PatientsRegistryRateLimitException(retryAfter);
    }
    bucket.count += 1;
    this.searchBuckets.set(key, bucket);
  }

  private async snapshot(client: PoolClient, input: { clinicId: string; locationId: string }): Promise<string> {
    const result = await client.query<{ sequence: string }>(`
      SELECT COALESCE(MAX(revision_sequence), 0)::text AS sequence
      FROM clinic_schema.clinic_patient_association_revisions
      WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid
    `, [input.clinicId, input.locationId]);
    return result.rows[0].sequence;
  }

  private query(client: PoolClient, input: { clinicId: string; locationId: string; q?: string; limit: number }, policyVersion: string, now: Date, snapshot: string, cursor?: Cursor) {
    const escapedPrefix = input.q?.replace(/[\\%_]/g, '\\$&');
    return client.query<RegistryRow>(`
      WITH snapshot_rows AS MATERIALIZED (
        SELECT DISTINCT ON (r.association_id)
          r.association_id,r.pet_id,r.status,r.current_consent_id,r.visibility_expires_at,r.last_qualified_at
        FROM clinic_schema.clinic_patient_association_revisions r
        WHERE r.clinic_id=$1::uuid AND r.clinic_location_id=$2::uuid
          AND r.revision_sequence <= $3::bigint
        ORDER BY r.association_id,r.revision_sequence DESC
      ), visible AS MATERIALIZED (
        SELECT r.pet_id,r.last_qualified_at
        FROM snapshot_rows r
        JOIN clinic_schema.clinic_patient_associations a ON a.id=r.association_id
          AND a.clinic_id=$1::uuid AND a.clinic_location_id=$2::uuid AND a.pet_id=r.pet_id
          AND a.current_consent_id=r.current_consent_id
        JOIN clinic_schema.clinic_patient_consents c ON c.id=r.current_consent_id
          AND c.clinic_id=$1::uuid AND c.clinic_location_id=$2::uuid AND c.pet_id=r.pet_id
        JOIN pet_schema.pets p ON p.id=r.pet_id AND p.archived_at IS NULL
        WHERE r.status='ACTIVE' AND r.visibility_expires_at > $4::timestamptz
          AND a.status='ACTIVE' AND a.revoked_at IS NULL AND a.archived_at IS NULL
          AND a.visibility_policy_version=$5 AND a.visibility_expires_at > $4::timestamptz
          AND c.purpose='PATIENT_ADMIN_REGISTRY' AND c.revoked_at IS NULL
          AND c.granted_at <= $4::timestamptz AND (c.expires_at IS NULL OR c.expires_at > $4::timestamptz)
          AND ($6::text IS NULL OR lower(p.name) LIKE $6::text || '%' ESCAPE '\\')
          AND ($7::timestamptz IS NULL OR (r.last_qualified_at,r.pet_id) < ($7::timestamptz,$8::uuid))
        ORDER BY r.last_qualified_at DESC,r.pet_id DESC
        LIMIT $9
      ), appointment_aggregates AS (
        SELECT v.pet_id,
          MIN(a.created_at) AS first_seen_at,
          MAX(a.created_at) AS last_seen_at,
          MAX(s.starts_at) FILTER (WHERE s.starts_at <= $4::timestamptz AND a.status IN ('COMPLETED','NO_SHOW')) AS last_visit_at,
          MIN(s.starts_at) FILTER (WHERE s.starts_at > $4::timestamptz AND a.status NOT IN ('CLINIC_CANCELLED','CANCELLED')) AS next_appointment_at
        FROM visible v
        JOIN booking_schema.appointments a ON a.pet_id=v.pet_id AND a.clinic_location_id=$2::uuid
        JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id AND s.clinic_location_id=$2::uuid
        GROUP BY v.pet_id
      )
      SELECT v.pet_id::text AS patient_id,p.name AS display_name,p.species,p.breed,p.sex,
        p.birth_date,aa.first_seen_at,v.last_qualified_at AS last_seen_at,
        aa.last_visit_at,aa.next_appointment_at
      FROM visible v
      JOIN pet_schema.pets p ON p.id=v.pet_id
      JOIN appointment_aggregates aa ON aa.pet_id=v.pet_id
      ORDER BY v.last_qualified_at DESC,v.pet_id DESC
    `, [input.clinicId, input.locationId, snapshot, now, policyVersion, escapedPrefix ?? null,
      cursor?.lastSeenAt ?? null, cursor?.patientId ?? null, input.limit + 1]);
  }

  private async assertLocation(client: PoolClient, clinicId: string, locationId: string): Promise<void> {
    const result = await client.query('SELECT 1 FROM clinic_schema.clinic_locations WHERE id=$1::uuid AND clinic_id=$2::uuid', [locationId, clinicId]);
    if (!result.rows[0]) throw new BadRequestException({ code: 'CLINIC_SCOPE_MISMATCH', message: 'Clinic scope mismatch' });
  }

  private encode(payload: Cursor): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.cursorSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private decode(value: string, input: { clinicId: string; locationId: string; q?: string; limit: number }): Cursor {
    try {
      const [body, signature, extra] = value.split('.');
      if (!body || !signature || extra) throw new Error();
      const expected = createHmac('sha256', this.cursorSecret).update(body).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Cursor;
      if (parsed.v !== 1 || parsed.clinicId !== input.clinicId || parsed.locationId !== input.locationId
        || parsed.q !== (input.q ?? null) || parsed.limit !== input.limit
        || !/^\d+$/.test(parsed.snapshotSequence) || Number(parsed.snapshotSequence) < 0
        || !this.isStrictTimestamp(parsed.lastSeenAt)
        || !UUID.test(parsed.patientId)) throw new Error();
      return parsed;
    } catch {
      throw new BadRequestException({ code: 'INVALID_PATIENTS_REGISTRY_CURSOR', message: 'Invalid registry cursor' });
    }
  }

  private dateOnly(value: string | Date): string {
    const date = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid patients registry row');
    }
    return date;
  }

  private isStrictTimestamp(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value;
  }

  private toItem(row: RegistryRow): ClinicPatientsRegistryDto['items'][number] {
    const dates = [row.first_seen_at, row.last_seen_at, row.last_visit_at, row.next_appointment_at];
    if (!UUID.test(row.patient_id) || typeof row.display_name !== 'string' || row.display_name.trim() === ''
      || typeof row.species !== 'string' || row.species.trim() === ''
      || (row.breed !== null && typeof row.breed !== 'string')
      || (row.sex !== null && !['MALE', 'FEMALE', 'UNKNOWN'].includes(row.sex))
      || dates.some((date) => date !== null && (!(date instanceof Date) || !Number.isFinite(date.getTime())))) {
      throw new Error('Invalid patients registry row');
    }
    return {
      patientId: row.patient_id,
      pet: {
        displayName: row.display_name,
        speciesLabel: SPECIES[row.species] ?? row.species,
        breed: row.breed,
        sexCode: row.sex,
        birthDate: row.birth_date ? this.dateOnly(row.birth_date) : null,
      },
      owner: { displayName: null },
      relationship: { firstSeenAt: row.first_seen_at.toISOString(), lastSeenAt: row.last_seen_at.toISOString() },
      appointments: {
        lastVisitAt: row.last_visit_at?.toISOString() ?? null,
        nextAppointmentAt: row.next_appointment_at?.toISOString() ?? null,
      },
    };
  }
}
