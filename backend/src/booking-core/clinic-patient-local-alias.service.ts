import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainException, DomainErrors } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPatientLocalAliasDto } from './dto/update-clinic-patient-local-alias.dto';

type IdempotencyRow = {
  status: string;
  response_status: number | null;
  response_body: unknown;
  request_fingerprint: string | null;
};
type AssociationRow = { id: string };
type ProfileRow = {
  alias: string | null;
  aggregate_version: number;
  updated_at: Date;
};

const unavailable = (): never => {
  throw new NotFoundException({ code: 'PATIENT_RESOURCE_UNAVAILABLE', message: 'Patient resource unavailable' });
};

@Injectable()
export class ClinicPatientLocalAliasService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async update(input: {
    clinicId: string;
    locationId: string;
    patientId: string;
    employee: JwtPayload;
    alias: string | null;
    expectedVersion: number;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<ClinicPatientLocalAliasDto> {
    const policyVersion = this.policyVersion();
    const scope = [
      'clinic-patient-local-alias-v1', input.employee.sub, input.clinicId, input.locationId, input.patientId,
    ].join(':');
    const fingerprint = createHash('sha256').update(JSON.stringify({ alias: input.alias })).digest('hex');

    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '250ms'");
      await client.query("SET LOCAL statement_timeout = '1000ms'");
      try {
        if (!input.employee.clinicIds?.includes(input.clinicId)) throw DomainErrors.clinicScopeMismatch();
        await this.clinicAccess.assertPatientLocalProfileUpdateAccess(
          client, input.employee, input.clinicId, input.locationId,
        );
      } catch (error) {
        if (error instanceof DomainException) return unavailable();
        throw error;
      }
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint);
      if (replay) return replay;

      const now = await this.dbNow(client);
      const association = await this.visibleAssociation(client, input, policyVersion, now);
      if (!association) return unavailable();

      const current = await client.query<ProfileRow>(`
        SELECT alias,aggregate_version,updated_at
        FROM clinic_schema.clinic_patient_local_profiles
        WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid AND patient_id=$3::uuid
        FOR UPDATE
      `, [input.clinicId, input.locationId, input.patientId]);
      const previousVersion = current.rows[0]?.aggregate_version ?? 0;
      if (input.expectedVersion !== previousVersion) throw DomainErrors.patientVersionStale();

      const changed = current.rows[0]
        ? await client.query<ProfileRow>(`
            UPDATE clinic_schema.clinic_patient_local_profiles
            SET alias=$4,aggregate_version=aggregate_version+1,updated_at=clock_timestamp()
            WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid AND patient_id=$3::uuid
              AND aggregate_version=$5
            RETURNING alias,aggregate_version,updated_at
          `, [input.clinicId, input.locationId, input.patientId, input.alias, previousVersion])
        : await client.query<ProfileRow>(`
            INSERT INTO clinic_schema.clinic_patient_local_profiles
              (clinic_id,clinic_location_id,patient_id,alias,aggregate_version)
            VALUES ($1::uuid,$2::uuid,$3::uuid,$4,1)
            RETURNING alias,aggregate_version,updated_at
          `, [input.clinicId, input.locationId, input.patientId, input.alias]);
      const row = changed.rows[0];
      if (!row) throw DomainErrors.patientVersionStale();

      const result: ClinicPatientLocalAliasDto = {
        patientId: input.patientId,
        clinicId: input.clinicId,
        locationId: input.locationId,
        alias: row.alias,
        aggregateVersion: row.aggregate_version,
        updatedAt: row.updated_at.toISOString(),
      };
      await this.writeAuditAndOutbox(client, input, association.id, previousVersion, row.aggregate_version);
      await this.completeIdempotency(client, scope, input.idempotencyKey, result);
      return result;
    });
  }

  private policyVersion(): string {
    const version = process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION?.trim();
    const days = Number(process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS);
    if (!version || !Number.isInteger(days) || days <= 0) {
      throw new ServiceUnavailableException({
        code: 'POLICY_TEMPORARILY_UNAVAILABLE', message: 'Patient visibility policy unavailable',
      });
    }
    return version;
  }

  private async visibleAssociation(
    client: PoolClient,
    input: { clinicId: string; locationId: string; patientId: string },
    policyVersion: string,
    now: Date,
  ): Promise<AssociationRow | undefined> {
    const result = await client.query<AssociationRow>(`
      SELECT a.id::text
      FROM clinic_schema.clinic_patient_associations a
      JOIN clinic_schema.clinic_patient_consents c
        ON c.id=a.current_consent_id AND c.clinic_id=$1::uuid
       AND c.clinic_location_id=$2::uuid AND c.pet_id=$3::uuid
      JOIN clinic_schema.clinic_locations l
        ON l.id=$2::uuid AND l.clinic_id=$1::uuid AND l.status='ACTIVE'
      JOIN pet_schema.pets p ON p.id=$3::uuid AND p.archived_at IS NULL
      WHERE a.clinic_id=$1::uuid AND a.clinic_location_id=$2::uuid AND a.pet_id=$3::uuid
        AND a.status='ACTIVE' AND a.revoked_at IS NULL AND a.archived_at IS NULL
        AND a.visibility_policy_version=$4 AND a.visibility_expires_at>$5::timestamptz
        AND c.purpose='PATIENT_ADMIN_REGISTRY' AND c.revoked_at IS NULL
        AND c.granted_at<=$5::timestamptz AND (c.expires_at IS NULL OR c.expires_at>$5::timestamptz)
      FOR UPDATE OF a
    `, [input.clinicId, input.locationId, input.patientId, policyVersion, now]);
    return result.rows[0];
  }

  private async acquireIdempotency(
    client: PoolClient,
    scope: string,
    key: string,
    fingerprint: string,
  ): Promise<ClinicPatientLocalAliasDto | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records
        (scope,idempotency_key,status,request_fingerprint)
      VALUES ($1,$2::uuid,'PROCESSING',$3)
      ON CONFLICT (scope,idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key, fingerprint]);
    if (inserted.rows[0]) return undefined;
    const existing = await client.query<IdempotencyRow>(`
      SELECT status,response_status,response_body,request_fingerprint
      FROM booking_schema.idempotency_records
      WHERE scope=$1 AND idempotency_key=$2::uuid
      FOR UPDATE
    `, [scope, key]);
    const row = existing.rows[0];
    if (!row) throw DomainErrors.bookingUnavailable();
    if (row.request_fingerprint !== fingerprint) {
      throw new DomainException(HttpStatus.CONFLICT, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused');
    }
    if (row.status !== 'COMPLETED' || row.response_status !== HttpStatus.OK || !row.response_body) {
      throw DomainErrors.idempotencyInProgress();
    }
    return row.response_body as ClinicPatientLocalAliasDto;
  }

  private async completeIdempotency(
    client: PoolClient,
    scope: string,
    key: string,
    result: ClinicPatientLocalAliasDto,
  ): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status='COMPLETED',response_status=$3,response_body=$4::jsonb,updated_at=clock_timestamp()
      WHERE scope=$1 AND idempotency_key=$2::uuid
    `, [scope, key, HttpStatus.OK, JSON.stringify(result)]);
  }

  private async writeAuditAndOutbox(
    client: PoolClient,
    input: {
      clinicId: string; locationId: string; patientId: string; employee: JwtPayload;
      alias: string | null; idempotencyKey: string; correlationId: string;
    },
    associationId: string,
    previousVersion: number,
    newVersion: number,
  ): Promise<void> {
    const operation = input.alias === null ? 'CLEAR' : 'SET';
    const payload = {
      clinicId: input.clinicId,
      locationId: input.locationId,
      patientId: input.patientId,
      associationId,
      idempotencyKey: input.idempotencyKey,
      previousVersion,
      newVersion,
      changedFields: ['alias'],
      operation,
    };
    await client.query(`
      INSERT INTO audit_schema.audit_log
        (actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json)
      VALUES ('CLINIC_EMPLOYEE',$1,'clinic.patient-local-alias.updated',
        'clinic_patient_local_profile',$2::uuid,$3::uuid,$4::jsonb)
    `, [input.employee.sub, associationId, input.correlationId, JSON.stringify(payload)]);
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type,producer,correlation_id,causation_id,aggregate_type,aggregate_id,
        aggregate_version,payload_json,deduplication_key)
      VALUES ('clinic.patient-local-alias.updated.v1','clinic-patient-local-profile',
        $1::uuid,$2::uuid,'ClinicPatientLocalProfile',$3::uuid,$4,$5::jsonb,$6)
    `, [
      input.correlationId,
      input.idempotencyKey,
      associationId,
      newVersion,
      JSON.stringify(payload),
      `clinic.patient-local-alias.updated.v1:${associationId}:${newVersion}`,
    ]);
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT statement_timestamp() AS now');
    const now = result.rows[0]?.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid database time');
    return now;
  }
}
