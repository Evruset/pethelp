import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

const PURPOSE = 'PATIENT_ADMIN_REGISTRY';
const QUALIFYING_STATUSES = ['CONFIRMED', 'CLINIC_CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CLINIC_CANCELLED', 'CANCELLED'];

type Scope = { tenantId: string; clinicId: string; locationId: string; petId: string };
type EventBase = Scope & {
  sourceEventId: string;
  sourceAggregateVersion: number;
  correlationId?: string;
};
export type AppointmentEvidence = EventBase & {
  sourceAppointmentId: string;
  consentId: string;
  expectedAssociationVersion?: number;
};
export type ArchiveEvidence = EventBase & {
  expectedAssociationVersion: number;
  reason: 'PET_ARCHIVED';
};
export type RevokeEvidence = EventBase & {
  expectedAssociationVersion: number;
  consentId: string;
  actorType: string;
  actorId: string;
  reason: 'CONSENT_WITHDRAWN' | 'OWNER_DELETED' | 'OWNER_ANONYMIZED';
};
export type AssociationLifecycleOutcome =
  | { kind: 'APPLIED'; associationId: string; version: number; status: Status; transition: Transition }
  | { kind: 'REPLAY'; associationId: string; version: number; status: Status }
  | { kind: 'REJECTED'; code: 'SCOPE_MISMATCH' | 'EVIDENCE_NOT_QUALIFYING' | 'CONSENT_INVALID' | 'POLICY_UNAVAILABLE' | 'VERSION_CONFLICT' | 'TRANSITION_NOT_ALLOWED' };

type Status = 'ACTIVE' | 'ARCHIVED' | 'REVOKED';
type Transition = 'ACTIVATED' | 'REFRESHED' | 'ARCHIVED' | 'REVOKED' | 'REACTIVATED';
type AssociationRow = {
  id: string; status: Status; source_appointment_id: string; current_consent_id: string;
  first_qualified_at: Date; last_qualified_at: Date; archived_at: Date | null;
  revoked_at: Date | null; version: number;
};
type AppointmentRow = { id: string; version: number; created_at: Date };
type ConsentRow = { id: string; granted_at: Date; expires_at: Date | null };
type Policy = { version: string; days: number };

@Injectable()
export class ClinicPatientAssociationLifecycleService {
  constructor(private readonly database: DatabaseService) {}

  async applyQualifyingAppointmentEvidence(input: AppointmentEvidence): Promise<AssociationLifecycleOutcome> {
    try {
      return await this.database.withTransaction(async (client) => {
        await this.lockScope(client, input);
        const replay = await this.replay(client, input.sourceEventId, input);
        if (replay) return replay;
        const policy = visibilityPolicy();
        if (!policy) return rejected('POLICY_UNAVAILABLE');
        const appointment = await this.qualifyingAppointment(client, input);
        if (!appointment) return rejected('EVIDENCE_NOT_QUALIFYING');
        if (appointment.version !== input.sourceAggregateVersion) return rejected('VERSION_CONFLICT');
        const consent = await this.validConsent(client, input.consentId, input);
        if (!consent) return rejected('CONSENT_INVALID');
        if (!(await this.withinVisibilityWindow(client, appointment.created_at, policy.days))) {
          return rejected('CONSENT_INVALID');
        }
        const association = await this.association(client, input);

        if (!association) {
          if (input.expectedAssociationVersion !== undefined && input.expectedAssociationVersion !== 0) return rejected('VERSION_CONFLICT');
          return this.activate(client, input, appointment, consent, policy);
        }
        if (input.expectedAssociationVersion === undefined || association.version !== input.expectedAssociationVersion) {
          return rejected('VERSION_CONFLICT');
        }
        if (association.status === 'ACTIVE') {
          if (association.current_consent_id !== consent.id) return rejected('CONSENT_INVALID');
          if (appointment.created_at <= association.last_qualified_at) return rejected('EVIDENCE_NOT_QUALIFYING');
          return this.refresh(client, input, appointment, association, consent, policy);
        }
        const boundary = association.status === 'REVOKED' ? association.revoked_at : association.archived_at;
        if (!boundary || consent.id === association.current_consent_id
          || consent.granted_at <= boundary || appointment.created_at <= boundary) {
          return rejected('TRANSITION_NOT_ALLOWED');
        }
        return this.reactivate(client, input, appointment, association, consent, policy);
      });
    } catch (error) {
      return (await this.replayAfterUniqueConflict(error, input.sourceEventId, input)) ?? Promise.reject(error);
    }
  }

  async archiveAssociation(input: ArchiveEvidence): Promise<AssociationLifecycleOutcome> {
    if (input.tenantId !== input.clinicId) return rejected('SCOPE_MISMATCH');
    try {
      return await this.database.withTransaction(async (client) => {
        await this.lockScope(client, input);
        const valid = await client.query(`
          SELECT 1 FROM clinic_schema.clinic_locations location
          JOIN pet_schema.pets pet ON pet.id = $4::uuid
          WHERE $1::uuid = $2::uuid AND location.id = $3::uuid
            AND location.clinic_id = $2::uuid AND pet.archived_at IS NOT NULL
        `, [input.tenantId, input.clinicId, input.locationId, input.petId]);
        if (!valid.rows[0]) return rejected('SCOPE_MISMATCH');
        const replay = await this.replay(client, input.sourceEventId, input);
        if (replay) return replay;
        const association = await this.association(client, input);
        if (!association) return rejected('SCOPE_MISMATCH');
        if (association.version !== input.expectedAssociationVersion) return rejected('VERSION_CONFLICT');
        if (association.status !== 'ACTIVE') return rejected('TRANSITION_NOT_ALLOWED');
        const result = await client.query<AssociationRow>(`
          UPDATE clinic_schema.clinic_patient_associations
          SET status='ARCHIVED', archived_at=clock_timestamp(), archive_reason=$3,
              version=version+1, updated_at=clock_timestamp()
          WHERE id=$1::uuid AND version=$2 RETURNING *
        `, [association.id, association.version, input.reason]);
        return result.rows[0] ? this.recordEffect(client, input, result.rows[0], 'ARCHIVED') : rejected('VERSION_CONFLICT');
      });
    } catch (error) {
      return (await this.replayAfterUniqueConflict(error, input.sourceEventId, input)) ?? Promise.reject(error);
    }
  }

  async revokeAssociation(input: RevokeEvidence): Promise<AssociationLifecycleOutcome> {
    if (input.tenantId !== input.clinicId) return rejected('SCOPE_MISMATCH');
    if (!input.actorType.trim() || !input.actorId.trim()) return rejected('CONSENT_INVALID');
    try {
      return await this.database.withTransaction(async (client) => {
        await this.lockScope(client, input);
        const replay = await this.replay(client, input.sourceEventId, input);
        if (replay) return replay;
        const association = await this.association(client, input);
        if (!association || association.current_consent_id !== input.consentId) return rejected('SCOPE_MISMATCH');
        if (association.version < input.expectedAssociationVersion) return rejected('VERSION_CONFLICT');
        if (association.status === 'REVOKED') return rejected('TRANSITION_NOT_ALLOWED');
        const consent = await client.query(`
          UPDATE clinic_schema.clinic_patient_consents
          SET revoked_at=clock_timestamp(), revoked_by_actor_type=$5,
              revoked_by_actor_id=$6, revoke_reason=$7, version=version+1,
              updated_at=clock_timestamp()
          WHERE id=$4::uuid AND clinic_id=$1::uuid AND clinic_location_id=$2::uuid
            AND pet_id=$3::uuid AND purpose='${PURPOSE}' AND revoked_at IS NULL
          RETURNING id
        `, [input.clinicId, input.locationId, input.petId, input.consentId, input.actorType, input.actorId, input.reason]);
        if (!consent.rows[0]) return rejected('CONSENT_INVALID');
        const result = await client.query<AssociationRow>(`
          UPDATE clinic_schema.clinic_patient_associations
          SET status='REVOKED', revoked_at=clock_timestamp(), revoke_reason=$3,
              version=version+1, updated_at=clock_timestamp()
          WHERE id=$1::uuid AND version=$2 RETURNING *
        `, [association.id, association.version, input.reason]);
        return result.rows[0] ? this.recordEffect(client, input, result.rows[0], 'REVOKED') : rejected('VERSION_CONFLICT');
      });
    } catch (error) {
      return (await this.replayAfterUniqueConflict(error, input.sourceEventId, input)) ?? Promise.reject(error);
    }
  }

  private async activate(client: PoolClient, input: AppointmentEvidence, appointment: AppointmentRow, consent: ConsentRow, policy: Policy) {
    const result = await client.query<AssociationRow>(`
      INSERT INTO clinic_schema.clinic_patient_associations (
        clinic_id,clinic_location_id,pet_id,status,source_type,source_appointment_id,
        current_consent_id,visibility_policy_version,visibility_expires_at,
        first_qualified_at,last_qualified_at
      ) VALUES ($1::uuid,$2::uuid,$3::uuid,'ACTIVE','APPOINTMENT',$4::uuid,$5::uuid,$6,
        LEAST($7::timestamptz+make_interval(days=>$8),COALESCE($9::timestamptz,'infinity'::timestamptz)),
        $7::timestamptz,$7::timestamptz) RETURNING *
    `, [input.clinicId, input.locationId, input.petId, appointment.id, consent.id, policy.version, appointment.created_at, policy.days, consent.expires_at]);
    return this.recordEffect(client, input, result.rows[0], 'ACTIVATED');
  }

  private async refresh(client: PoolClient, input: AppointmentEvidence, appointment: AppointmentRow, association: AssociationRow, consent: ConsentRow, policy: Policy) {
    const result = await client.query<AssociationRow>(`
      UPDATE clinic_schema.clinic_patient_associations
      SET source_appointment_id=$3::uuid,last_qualified_at=$4::timestamptz,
          visibility_policy_version=$5,
          visibility_expires_at=LEAST($4::timestamptz+make_interval(days=>$6),COALESCE($7::timestamptz,'infinity'::timestamptz)),
          version=version+1,updated_at=clock_timestamp()
      WHERE id=$1::uuid AND version=$2 RETURNING *
    `, [association.id, association.version, appointment.id, appointment.created_at, policy.version, policy.days, consent.expires_at]);
    return result.rows[0] ? this.recordEffect(client, input, result.rows[0], 'REFRESHED') : rejected('VERSION_CONFLICT');
  }

  private async reactivate(client: PoolClient, input: AppointmentEvidence, appointment: AppointmentRow, association: AssociationRow, consent: ConsentRow, policy: Policy) {
    const result = await client.query<AssociationRow>(`
      UPDATE clinic_schema.clinic_patient_associations
      SET status='ACTIVE',source_appointment_id=$3::uuid,current_consent_id=$4::uuid,
          last_qualified_at=$5::timestamptz,visibility_policy_version=$6,
          visibility_expires_at=LEAST($5::timestamptz+make_interval(days=>$7),COALESCE($8::timestamptz,'infinity'::timestamptz)),
          archived_at=NULL,archive_reason=NULL,revoked_at=NULL,revoke_reason=NULL,
          version=version+1,updated_at=clock_timestamp()
      WHERE id=$1::uuid AND version=$2 RETURNING *
    `, [association.id, association.version, appointment.id, consent.id, appointment.created_at, policy.version, policy.days, consent.expires_at]);
    return result.rows[0] ? this.recordEffect(client, input, result.rows[0], 'REACTIVATED') : rejected('VERSION_CONFLICT');
  }

  private async recordEffect(client: PoolClient, input: EventBase, association: AssociationRow, transition: Transition): Promise<AssociationLifecycleOutcome> {
    const eventType = `clinic.patient-association.${transition.toLowerCase()}.v1`;
    await client.query(`
      INSERT INTO clinic_schema.clinic_patient_association_event_receipts
        (source_event_id,association_id,source_aggregate_id,source_aggregate_version,event_type)
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5)
    `, [input.sourceEventId, association.id, association.source_appointment_id, input.sourceAggregateVersion, eventType]);
    await client.query(`
      INSERT INTO clinic_schema.clinic_patient_association_revisions (
        association_id,association_version,clinic_id,clinic_location_id,pet_id,status,
        source_type,source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at)
      SELECT id,version,clinic_id,clinic_location_id,pet_id,status,source_type,
             source_appointment_id,current_consent_id,visibility_expires_at,last_qualified_at
      FROM clinic_schema.clinic_patient_associations WHERE id=$1::uuid AND version=$2
    `, [association.id, association.version]);
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type,producer,correlation_id,causation_id,aggregate_type,aggregate_id,
        aggregate_version,payload_json,deduplication_key)
      VALUES ($1,'clinic-patient-association',$2::uuid,$3::uuid,'ClinicPatientAssociation',
        $4::uuid,$5,$6::jsonb,$7)
    `, [eventType, input.correlationId ?? null, input.sourceEventId, association.id, association.version, JSON.stringify({
      eventId: input.sourceEventId, associationId: association.id, aggregateVersion: association.version,
      tenantId: input.tenantId, clinicId: input.clinicId, locationId: input.locationId,
      petId: input.petId, sourceAppointmentId: association.source_appointment_id, transition,
    }), `${eventType}:${input.sourceEventId}`]);
    return { kind: 'APPLIED', associationId: association.id, version: association.version, status: association.status, transition };
  }

  private async qualifyingAppointment(client: PoolClient, input: AppointmentEvidence) {
    if (input.tenantId !== input.clinicId) return undefined;
    const result = await client.query<AppointmentRow>(`
      SELECT appointment.id::text,appointment.version,appointment.created_at
      FROM booking_schema.appointments appointment
      JOIN clinic_schema.clinic_locations location ON location.id=appointment.clinic_location_id
        AND location.id=$2::uuid AND location.clinic_id=$1::uuid
      JOIN pet_schema.pets pet ON pet.id=appointment.pet_id AND pet.id=$3::uuid AND pet.archived_at IS NULL
      WHERE appointment.id=$4::uuid AND appointment.pet_id=$3::uuid
        AND appointment.clinic_location_id=$2::uuid AND appointment.status=ANY($5::text[])
      FOR SHARE OF appointment,location,pet
    `, [input.clinicId, input.locationId, input.petId, input.sourceAppointmentId, QUALIFYING_STATUSES]);
    return result.rows[0];
  }

  private async validConsent(client: PoolClient, consentId: string, scope: Scope) {
    const result = await client.query<ConsentRow>(`
      SELECT id::text,granted_at,expires_at FROM clinic_schema.clinic_patient_consents
      WHERE id=$1::uuid AND clinic_id=$2::uuid AND clinic_location_id=$3::uuid
        AND pet_id=$4::uuid AND purpose='${PURPOSE}' AND granted_at<=clock_timestamp()
        AND (expires_at IS NULL OR expires_at>clock_timestamp()) AND revoked_at IS NULL
      FOR UPDATE
    `, [consentId, scope.clinicId, scope.locationId, scope.petId]);
    return result.rows[0];
  }

  private async association(client: PoolClient, scope: Scope) {
    const result = await client.query<AssociationRow>(`
      SELECT id::text,status,source_appointment_id::text,current_consent_id::text,
        first_qualified_at,last_qualified_at,archived_at,revoked_at,version
      FROM clinic_schema.clinic_patient_associations
      WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid AND pet_id=$3::uuid FOR UPDATE
    `, [scope.clinicId, scope.locationId, scope.petId]);
    return result.rows[0];
  }

  private async replay(client: PoolClient, eventId: string, scope: Scope): Promise<AssociationLifecycleOutcome | undefined> {
    const result = await client.query<AssociationRow>(`
      SELECT association.id::text,association.status,association.source_appointment_id::text,
        association.current_consent_id::text,association.first_qualified_at,
        association.last_qualified_at,association.archived_at,association.revoked_at,association.version
      FROM clinic_schema.clinic_patient_association_event_receipts receipt
      JOIN clinic_schema.clinic_patient_associations association ON association.id=receipt.association_id
      WHERE receipt.source_event_id=$1::uuid AND association.clinic_id=$2::uuid
        AND association.clinic_location_id=$3::uuid AND association.pet_id=$4::uuid
    `, [eventId, scope.clinicId, scope.locationId, scope.petId]);
    const row = result.rows[0];
    return row ? { kind: 'REPLAY', associationId: row.id, version: row.version, status: row.status } : undefined;
  }

  private async replayAfterUniqueConflict(error: unknown, eventId: string, scope: Scope) {
    if (!(typeof error === 'object' && error !== null && 'code' in error
      && (error as { code?: unknown }).code === '23505')) return undefined;
    const constraint = String((error as { constraint?: unknown }).constraint ?? '');
    const expected = new Set([
      'clinic_patient_association_event_receipts_pkey',
      'clinic_patient_association_receipts_semantic_key',
      'clinic_patient_associations_scope_key',
      'outbox_deduplication_idx',
    ]);
    if (!expected.has(constraint)) return undefined;
    return (await this.database.withTransaction((client) => this.replay(client, eventId, scope)))
      ?? rejected('SCOPE_MISMATCH');
  }

  private async withinVisibilityWindow(client: PoolClient, qualifiedAt: Date, days: number) {
    const result = await client.query<{ valid: boolean }>(
      'SELECT $1::timestamptz + make_interval(days=>$2) > clock_timestamp() AS valid',
      [qualifiedAt, days],
    );
    return result.rows[0].valid;
  }

  private lockScope(client: PoolClient, scope: Scope) {
    const key = [scope.tenantId, scope.clinicId, scope.locationId, scope.petId].map((value) => value.toLowerCase()).join(':');
    return client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]).then(() => undefined);
  }
}

function visibilityPolicy(): Policy | undefined {
  const version = process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION?.trim();
  const days = Number.parseInt(process.env.VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS ?? '', 10);
  return version && Number.isInteger(days) && days > 0 && days <= 3650 ? { version, days } : undefined;
}

function rejected(code: Extract<AssociationLifecycleOutcome, { kind: 'REJECTED' }>['code']): AssociationLifecycleOutcome {
  return { kind: 'REJECTED', code };
}
