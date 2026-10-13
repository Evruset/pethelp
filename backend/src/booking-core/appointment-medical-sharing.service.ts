import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { Capability } from '../auth/capability';
import { CapabilityEvaluatorService } from '../auth/capability-evaluator.service';
import { DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { openStoredPetDocument, type PetDocumentDownload, type StoredPetDocument } from '../common/pet-document-storage';

export type MedicalResourceRef = { type: 'RESULT' | 'AMENDMENT' | 'DOCUMENT'; id: string };
export type MedicalSelection = { mode: 'SELECTED' | 'ALL_CURRENT'; resources?: MedicalResourceRef[] };
type Context = { id: string; hold_id: string; owner_id: string; pet_id: string; clinic_id: string; location_id: string; status: string; lifecycle_state: string | null };
type Share = { id: string; appointment_id: string; owner_id: string; pet_id: string; clinic_id: string; location_id: string; status: 'ACTIVE' | 'REVOKED'; version: number; request_json: unknown; created_at: Date; revoked_at: Date | null; revoke_idempotency_key: string | null; revoke_expected_version: number | null };
const absent = () => new NotFoundException({ code: 'MEDICAL_SHARE_NOT_FOUND' });
const stateConflict = () => new ConflictException({ code: 'BOOKING_STATE_CONFLICT' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AppointmentMedicalSharingService {
  constructor(private readonly db: DatabaseService, private readonly access: ClinicEmployeeAccessService, private readonly capabilities: CapabilityEvaluatorService) {}

  ownerContext(appointmentId: string, actor: JwtPayload) {
    return this.db.withTransaction(async client => {
      const context = await this.context(client, appointmentId, actor.sub, false);
      const resources = await this.eligible(client, context);
      const shares = (await client.query<Share>('SELECT * FROM medical_schema.appointment_data_shares WHERE appointment_id=$1 AND owner_id=$2 ORDER BY created_at,id', [appointmentId, actor.sub])).rows;
      const views = await Promise.all(shares.map(share => this.view(client, share)));
      const presentation = (await client.query<{ clinic_name:string;address:string;pet_name:string;starts_at:Date;ends_at:Date;timezone:string }>(`SELECT clinic.public_name AS clinic_name,location.address,pet.name AS pet_name,slot.starts_at,slot.ends_at,clinic.timezone
        FROM booking_schema.appointments appointment JOIN clinic_schema.clinic_locations location ON location.id=appointment.clinic_location_id
        JOIN clinic_schema.clinics clinic ON clinic.id=location.clinic_id JOIN pet_schema.pets pet ON pet.id=appointment.pet_id
        JOIN clinic_schema.appointment_slots slot ON slot.id=appointment.slot_id WHERE appointment.id=$1 AND appointment.owner_id=$2`,[appointmentId,actor.sub])).rows[0];
      const references = [...resources.slice(0,200),...views.flatMap(share=>share.resources)];
      const details = (await client.query<{ type:MedicalResourceRef['type'];id:string;label:string;created_at:Date }>(`
        SELECT 'RESULT' AS type,id::text,'Результат приёма' AS label,published_at AS created_at FROM clinical_schema.visit_results WHERE owner_id=$1 AND pet_id=$2 AND status='PUBLISHED' AND id=ANY($3::uuid[])
        UNION ALL SELECT 'AMENDMENT',id::text,'Уточнение к результату',published_at FROM clinical_schema.visit_result_amendments WHERE owner_id=$1 AND pet_id=$2 AND id=ANY($4::uuid[])
        UNION ALL SELECT 'DOCUMENT',id::text,COALESCE(file_name,'Медицинский документ'),created_at FROM pet_schema.pet_documents WHERE owner_id=$1 AND pet_id=$2 AND doc_type IN('PASSPORT','HISTORY') AND id=ANY($5::uuid[])
        ORDER BY type,id`,[actor.sub,context.pet_id,...(['RESULT','AMENDMENT','DOCUMENT'].map(type=>[...new Set(references.filter(ref=>ref.type===type).map(ref=>ref.id))]))])).rows.map(row=>({type:row.type,id:row.id,label:row.label,createdAt:row.created_at.toISOString()}));
      return { appointmentId, petId: context.pet_id, clinicId: context.clinic_id, locationId: context.location_id,
        eligible: this.canGrant(context), resources: resources.slice(0,200), resourcesTruncated: resources.length>200, shares: views,
        clinic: {displayName:presentation.clinic_name,locationAddress:presentation.address},pet:{displayName:presentation.pet_name},
        appointment:{startsAt:presentation.starts_at.toISOString(),endsAt:presentation.ends_at.toISOString(),timezone:presentation.timezone},resourceDetails:details };
    });
  }

  create(appointmentId: string, selection: MedicalSelection, key: string, actor: JwtPayload, correlation: string) {
    const canonical = this.selection(selection);
    const request = { appointmentId, ...canonical };
    return this.db.withTransaction(async client => {
      // One Owner/key may not create grants for two appointments, even concurrently.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`medical-share:${actor.sub}:${key}`]);
      const replay = (await client.query<Share>('SELECT * FROM medical_schema.appointment_data_shares WHERE owner_id=$1 AND idempotency_key=$2', [actor.sub, key])).rows[0];
      if (replay) {
        if (JSON.stringify(replay.request_json) !== JSON.stringify(JSON.parse(JSON.stringify(request)))) {
          // jsonb key order is not request order; semantic comparison stays inside PostgreSQL.
          const equal = (await client.query<{ equal: boolean }>('SELECT request_json=$2::jsonb AS equal FROM medical_schema.appointment_data_shares WHERE id=$1', [replay.id, JSON.stringify(request)])).rows[0].equal;
          if (!equal) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
        }
        return this.view(client, replay);
      }
      const context = await this.context(client, appointmentId, actor.sub, true);
      if (!this.canGrant(context)) throw stateConflict();
      const eligible = await this.eligible(client, context, canonical.mode === 'SELECTED' ? canonical.resources : undefined);
      const resources = canonical.mode === 'ALL_CURRENT' ? eligible : canonical.resources!;
      if (!resources.length || resources.length > 200) throw new BadRequestException({ code: 'INVALID_REQUEST' });
      const allowed = new Set(eligible.map(ref => `${ref.type}:${ref.id}`));
      if (resources.some(ref => !allowed.has(`${ref.type}:${ref.id}`))) throw absent();
      const share = (await client.query<Share>(`INSERT INTO medical_schema.appointment_data_shares(appointment_id,owner_id,pet_id,clinic_id,location_id,idempotency_key,request_json,correlation_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [context.id, context.owner_id, context.pet_id, context.clinic_id, context.location_id, key, JSON.stringify(request), correlation])).rows[0];
      for (const ref of resources) await client.query(`INSERT INTO medical_schema.appointment_data_share_resources(share_id,owner_id,pet_id,resource_type,resource_id,result_id,amendment_id,document_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [share.id, context.owner_id, context.pet_id, ref.type, ref.id, ref.type === 'RESULT' ? ref.id : null, ref.type === 'AMENDMENT' ? ref.id : null, ref.type === 'DOCUMENT' ? ref.id : null]);
      await this.evidence(client, share, 'medical.share.granted', resources, actor.sub, correlation);
      return this.view(client, share);
    });
  }

  revoke(appointmentId: string, shareId: string, expected: number, key: string, actor: JwtPayload, correlation: string) {
    return this.db.withTransaction(async client => {
      const share = (await client.query<Share>('SELECT * FROM medical_schema.appointment_data_shares WHERE id=$1 AND appointment_id=$2 AND owner_id=$3 FOR UPDATE', [shareId, appointmentId, actor.sub])).rows[0];
      if (!share) throw absent();
      if (share.status === 'REVOKED') {
        if (share.revoke_idempotency_key !== key || share.revoke_expected_version !== expected) throw stateConflict();
        return this.view(client, share);
      }
      if (share.version !== expected) throw stateConflict();
      const revoked = (await client.query<Share>(`UPDATE medical_schema.appointment_data_shares SET status='REVOKED',version=version+1,revoked_at=clock_timestamp(),revoke_idempotency_key=$2,revoke_expected_version=$3 WHERE id=$1 RETURNING *`, [shareId, key, expected])).rows[0];
      await this.evidence(client, revoked, 'medical.share.revoked', await this.refs(client, share.id), actor.sub, correlation);
      return this.view(client, revoked);
    });
  }

  clinicList(appointmentId: string, actor: JwtPayload) {
    return this.db.withTransaction(async client => {
      const context = await this.clinicAuthority(client, appointmentId, actor);
      const shares = (await client.query<Share>(`SELECT * FROM medical_schema.appointment_data_shares WHERE appointment_id=$1 AND clinic_id=$2 AND location_id=$3 AND status='ACTIVE' ORDER BY created_at,id FOR SHARE`, [appointmentId, context.clinic_id, context.location_id])).rows;
      const all = (await Promise.all(shares.map(share => this.refs(client, share.id)))).flat();
      const resources = [...new Map(all.map(ref => [`${ref.type}:${ref.id}`, ref])).values()].sort(compareRefs);
      return { appointmentId, status: resources.length ? 'SHARED' as const : 'NOT_SHARED' as const, resources };
    });
  }

  clinicRead(appointmentId: string, ref: MedicalResourceRef, actor: JwtPayload) {
    return this.db.withTransaction(async client => {
      const context = await this.clinicAuthority(client, appointmentId, actor);
      const grant = (await client.query<Share>(`SELECT share.* FROM medical_schema.appointment_data_shares share
        JOIN medical_schema.appointment_data_share_resources resource ON resource.share_id=share.id
        WHERE share.appointment_id=$1 AND share.clinic_id=$2 AND share.location_id=$3 AND share.status='ACTIVE'
          AND resource.resource_type=$4 AND resource.resource_id=$5 ORDER BY share.id LIMIT 1 FOR SHARE OF share`, [appointmentId, context.clinic_id, context.location_id, ref.type, ref.id])).rows[0];
      if (!grant) throw absent();
      if (ref.type === 'RESULT') {
        const result = (await client.query<{ content: string; published_at: Date }>('SELECT clinical_summary AS content,published_at FROM clinical_schema.visit_results WHERE id=$1 AND owner_id=$2 AND pet_id=$3 AND status=\'PUBLISHED\'', [ref.id, grant.owner_id, grant.pet_id])).rows[0];
        if (!result) throw absent();
        return { ...ref, content: result.content, publishedAt: result.published_at.toISOString() };
      }
      if (ref.type === 'AMENDMENT') {
        const amendment = (await client.query<{ content: string; published_at: Date; version: number }>('SELECT amendment_content AS content,published_at,version FROM clinical_schema.visit_result_amendments WHERE id=$1 AND owner_id=$2 AND pet_id=$3', [ref.id, grant.owner_id, grant.pet_id])).rows[0];
        if (!amendment) throw absent();
        return { ...ref, content: amendment.content, publishedAt: amendment.published_at.toISOString(), version: amendment.version };
      }
      const document = (await client.query<{ file_name: string | null; mime_type: string | null; created_at: Date }>('SELECT file_name,mime_type,created_at FROM pet_schema.pet_documents WHERE id=$1 AND owner_id=$2 AND pet_id=$3 AND deleted_at IS NULL AND doc_type IN(\'PASSPORT\',\'HISTORY\')', [ref.id, grant.owner_id, grant.pet_id])).rows[0];
      if (!document) throw absent();
      return { ...ref, fileName: document.file_name, mimeType: document.mime_type, createdAt: document.created_at.toISOString() };
    });
  }

  async clinicDownload(appointmentId:string,documentId:string,actor:JwtPayload){
    let accepted:PetDocumentDownload|undefined;
    try{return await this.db.withTransaction(async client=>{
      const context=await this.clinicAuthority(client,appointmentId,actor);
      const grant=(await client.query<Share>(`SELECT share.* FROM medical_schema.appointment_data_shares share
        JOIN medical_schema.appointment_data_share_resources resource ON resource.share_id=share.id
        WHERE share.appointment_id=$1 AND share.clinic_id=$2 AND share.location_id=$3 AND share.status='ACTIVE'
          AND resource.resource_type='DOCUMENT' AND resource.resource_id=$4 ORDER BY share.id LIMIT 1 FOR SHARE OF share`,[appointmentId,context.clinic_id,context.location_id,documentId])).rows[0];
      if(!grant)throw absent();
      const document=(await client.query<StoredPetDocument>(`SELECT storage_key,file_name,mime_type,file_size_bytes FROM pet_schema.pet_documents
        WHERE id=$1 AND owner_id=$2 AND pet_id=$3 AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') FOR SHARE`,[documentId,grant.owner_id,grant.pet_id])).rows[0];
      if(!document)throw absent();
      try{accepted=await openStoredPetDocument(document);}catch{throw absent();}
      // This event records committed authorization, not proof of complete client delivery.
      await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,payload_json)
        VALUES('CLINIC_EMPLOYEE',$1,'medical.document.content.read','pet_document',$2,$3)`,[actor.sub,documentId,JSON.stringify({appointmentId,grantId:grant.id,clinicId:context.clinic_id,locationId:context.location_id,resourceType:'DOCUMENT'})]);
      return accepted;
    });}catch(error){accepted?.stream.destroy();throw error;}
  }

  private async clinicAuthority(client: PoolClient, id: string, actor: JwtPayload) {
    const context = (await client.query<Context>(`SELECT a.id,a.hold_id,a.owner_id,a.pet_id,a.clinic_location_id AS location_id,l.clinic_id,a.status,a.lifecycle_state FROM booking_schema.appointments a JOIN clinic_schema.clinic_locations l ON l.id=a.clinic_location_id WHERE a.id=$1 AND l.clinic_id=ANY($2::uuid[]) AND l.id=ANY($3::uuid[])`, [id, actor.clinicIds ?? [], actor.locationIds ?? []])).rows[0];
    if (!context) throw absent();
    try {
      await this.capabilities.assertAllowed(client, { actor, capability: Capability.MEDICAL_SHARED_DATA_READ, resource: { aggregateType: 'medical.share', clinicId: context.clinic_id, locationId: context.location_id } });
      await this.access.assertExactClinicLocationMembership(client, actor, context.clinic_id, context.location_id);
      // A role carried from another location is not medical authority here.
      const clinicalMembership = await client.query(`SELECT employee_id FROM clinic_schema.employee_location_memberships
        WHERE employee_id=$1 AND clinic_location_id=$2 AND role='CLINIC_VETERINARIAN'
          AND active=true AND revoked_at IS NULL FOR SHARE`, [actor.sub, context.location_id]);
      if (!clinicalMembership.rows[0]) throw absent();
    } catch (error) { if (error instanceof DomainException) throw absent(); throw error; }
    return context;
  }

  private async context(client: PoolClient, id: string, owner: string, lock: boolean) {
    if (lock) {
      const hold = (await client.query<{ hold_id: string }>('SELECT hold_id FROM booking_schema.appointments WHERE id=$1 AND owner_id=$2', [id, owner])).rows[0];
      if (!hold) throw absent();
      await client.query('SELECT id FROM booking_schema.booking_holds WHERE id=$1 FOR UPDATE', [hold.hold_id]);
    }
    const result = (await client.query<Context>(`SELECT a.id,a.hold_id,a.owner_id,a.pet_id,a.clinic_location_id AS location_id,l.clinic_id,a.status,a.lifecycle_state FROM booking_schema.appointments a JOIN clinic_schema.clinic_locations l ON l.id=a.clinic_location_id WHERE a.id=$1 AND a.owner_id=$2 ${lock ? 'FOR SHARE OF a' : ''}`, [id, owner])).rows[0];
    if (!result) throw absent();
    return result;
  }

  private canGrant(context: Context) { return (context.status === 'CONFIRMED' && ['CONFIRMED', 'RESCHEDULE_PROPOSED'].includes(context.lifecycle_state ?? '')) || (context.status === 'COMPLETED' && context.lifecycle_state === null); }

  private async eligible(client: PoolClient, context: Context, selected?: MedicalResourceRef[]): Promise<MedicalResourceRef[]> {
    const result = await client.query<{ type: MedicalResourceRef['type']; id: string }>(`
      SELECT 'RESULT' AS type,id::text FROM clinical_schema.visit_results WHERE owner_id=$1 AND pet_id=$2 AND status='PUBLISHED' AND ($3::uuid[] IS NULL OR id=ANY($3))
      UNION ALL SELECT 'AMENDMENT',id::text FROM clinical_schema.visit_result_amendments WHERE owner_id=$1 AND pet_id=$2 AND ($4::uuid[] IS NULL OR id=ANY($4))
      UNION ALL SELECT 'DOCUMENT',id::text FROM pet_schema.pet_documents WHERE owner_id=$1 AND pet_id=$2 AND deleted_at IS NULL AND doc_type IN('PASSPORT','HISTORY') AND ($5::uuid[] IS NULL OR id=ANY($5))
      ORDER BY type,id LIMIT 201`, [context.owner_id, context.pet_id, ...(['RESULT','AMENDMENT','DOCUMENT'].map(type=>selected ? selected.filter(ref=>ref.type===type).map(ref=>ref.id) : null))]);
    return result.rows;
  }

  private selection(input: MedicalSelection): MedicalSelection {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !['SELECTED', 'ALL_CURRENT'].includes(input.mode) || Object.keys(input).some(key => !['mode', 'resources'].includes(key))) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    if (input.mode === 'ALL_CURRENT') { if (input.resources !== undefined) throw new BadRequestException({ code: 'INVALID_REQUEST' }); return { mode: 'ALL_CURRENT' }; }
    if (!Array.isArray(input.resources) || !input.resources.length || input.resources.length > 200) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    for (const ref of input.resources) if (!ref || typeof ref !== 'object' || Array.isArray(ref) || Object.keys(ref).length !== 2 || !['RESULT', 'AMENDMENT', 'DOCUMENT'].includes(ref.type) || typeof ref.id !== 'string' || !UUID.test(ref.id)) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    const resources = input.resources.map(ref => ({ type: ref.type, id: ref.id.toLowerCase() })).sort(compareRefs);
    if (new Set(resources.map(ref => `${ref.type}:${ref.id}`)).size !== resources.length) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    return { mode: 'SELECTED', resources };
  }
  private async refs(client: PoolClient, id: string): Promise<MedicalResourceRef[]> { return (await client.query<{ type: MedicalResourceRef['type']; id: string }>('SELECT resource_type AS type,resource_id::text AS id FROM medical_schema.appointment_data_share_resources WHERE share_id=$1 ORDER BY resource_type,resource_id', [id])).rows; }
  private async view(client: PoolClient, row: Share) { return { id: row.id, appointmentId: row.appointment_id, petId: row.pet_id, clinicId: row.clinic_id, locationId: row.location_id, status: row.status, version: row.version, createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null, resources: await this.refs(client, row.id) }; }
  private async evidence(client: PoolClient, share: Share, event: string, refs: MedicalResourceRef[], actor: string, correlation: string) {
    await client.query('INSERT INTO medical_schema.share_events(share_id,event_type,actor_id,correlation_id,resource_refs) VALUES($1,$2,$3,$4,$5)', [share.id, event, actor, correlation, JSON.stringify(refs)]);
    const payload = JSON.stringify({ shareId: share.id, appointmentId: share.appointment_id, clinicId: share.clinic_id, locationId: share.location_id, version: share.version, state: share.status });
    await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('OWNER',$1,$2,'medical_share',$3,$4,$5)`, [actor, event, share.id, correlation, payload]);
    await client.query(`INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,$2,'medical_share',$3,$4,$5,$6)`, [event, correlation, share.id, share.version, payload, `${event}:${share.id}:${share.version}`]);
  }
}
function compareRefs(a: MedicalResourceRef, b: MedicalResourceRef) { return `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`); }
