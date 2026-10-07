import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import * as documentStorage from '../src/common/pet-document-storage';
import request from 'supertest';
import { Role } from '../src/auth/auth.types';
import { BookingErrorFilter } from '../src/common/booking-error.filter';
import { config } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { NestRoot } from '../src/nest-root-full';
import { OwnerPetService } from '../src/auth/owner-pet.service';

jest.setTimeout(90000);
const I = Object.fromEntries(['owner','otherOwner','vet','admin','reception','clinic','otherClinic','location','otherLocation','pet','service','slot','hold','appointment','visit','document','otherDocument'].map(key => [key, randomUUID()]));
const denied = { code: 'MEDICAL_SHARE_NOT_FOUND' };

describe('Wave 4A medical sharing (Docker PostgreSQL and real Nest HTTP)', () => {
  let app: INestApplication, db: DatabaseService, jwt: JwtService, result: string;
  const token = (sub = I.owner, roles = [Role.OWNER], clinics: string[] = [], locations: string[] = []) =>
    jwt.signAsync({ sub, roles, clinicIds: clinics, locationIds: locations }, { secret: config.jwtSecret, issuer: config.jwtIssuer, audience: config.jwtAudience, algorithm: 'HS256' });
  const vet = () => token(I.vet, [Role.CLINIC_VETERINARIAN], [I.clinic], [I.location]);
  const ownerPath = `/v1/owner/appointments/${I.appointment}/medical-shares`;
  const clinicPath = `/v1/clinic/appointments/${I.appointment}/medical-shares`;
  const grant = async (body: object, key = randomUUID(), auth?: string) => request(app.getHttpServer()).post(ownerPath)
    .set('Authorization', `Bearer ${auth ?? await token()}`).set('Idempotency-Key', key).set('X-Correlation-ID', randomUUID()).send(body);
  const read = async (id = result, type = 'RESULT', auth?: string) => request(app.getHttpServer()).get(`${clinicPath}/resources/${type}/${id}`).set('Authorization', `Bearer ${auth ?? await vet()}`);
  const list = async () => request(app.getHttpServer()).get(clinicPath).set('Authorization', `Bearer ${await vet()}`);
  const revoke = async (id: string, key = randomUUID(), expected = 1) => request(app.getHttpServer()).post(`${ownerPath}/${id}/revoke`)
    .set('Authorization', `Bearer ${await token()}`).set('Idempotency-Key', key).set('If-Match', `"${expected}"`).set('X-Correlation-ID', randomUUID()).send({});
  const selected = () => ({ mode: 'SELECTED', resources: [{ type: 'RESULT', id: result }, { type: 'DOCUMENT', id: I.document }] });
  const bytes=Buffer.from('%PDF-1.4\nPrivate acceptance document\n');
  const fixtureKey=`wave4a-test-${I.owner}/${I.document}.pdf`;
  const fixtureDirectory=path.dirname(documentStorage.petDocumentStoragePath(fixtureKey));
  const download=async(id=I.document,auth?:string)=>request(app.getHttpServer()).get(`${clinicPath}/resources/DOCUMENT/${id}/download`).set('Authorization',`Bearer ${auth??await vet()}`).buffer(true).parse((response,callback)=>{const chunks:Buffer[]=[];response.on('data',(chunk:Buffer)=>chunks.push(Buffer.from(chunk)));response.on('end',()=>{const buffer=Buffer.concat(chunks);callback(null,response.headers['content-type']?.includes('application/json')?JSON.parse(buffer.toString()):buffer);});});
  async function revokeAll() {
    const rows = (await db.query(`SELECT id FROM medical_schema.appointment_data_shares WHERE appointment_id=$1 AND status='ACTIVE'`, [I.appointment])).rows;
    for (const row of rows) expect((await revoke(row.id)).status).toBe(200);
  }
  async function waitForShareLock() {
    for(let attempt=0;attempt<100;attempt++) {
      const waiting=await db.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%medical_schema.appointment_data_shares%'`);
      if(waiting.rows.length)return;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    throw new Error('Expected real competing transaction blocked on share row');
  }
  beforeAll(async () => {
    if (process.env.WAVE4_ACCEPTANCE !== 'true' || new URL(config.databaseUrl).hostname !== 'postgres') throw new Error('Requires isolated Wave4 Docker Compose acceptance');
    app = await NestFactory.create(NestRoot, { logger: false }); app.useGlobalFilters(new BookingErrorFilter()); await app.init();
    db = app.get(DatabaseService); jwt = app.get(JwtService);
    await db.query(`INSERT INTO identity_schema.users(id) VALUES('${I.owner}'),('${I.otherOwner}'),('${I.vet}'),('${I.admin}'),('${I.reception}');
      INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES('${I.clinic}','A','A'),('${I.otherClinic}','B','B');
      INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address) VALUES('${I.location}','${I.clinic}','A'),('${I.otherLocation}','${I.otherClinic}','B');
      INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${I.vet}','${I.location}','CLINIC_VETERINARIAN'),('${I.admin}','${I.location}','CLINIC_ADMIN'),('${I.reception}','${I.location}','CLINIC_RECEPTIONIST');
      INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES('${I.service}','${I.location}','W4','Service',30);
      INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES('${I.slot}','${I.location}','${I.service}',clock_timestamp()-interval '1 hour',clock_timestamp());
      INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES('${I.pet}','${I.owner}','Pet','DOG');
      INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${I.hold}','${I.slot}','${I.owner}','${I.pet}','COMPLETED',clock_timestamp()+interval '1 hour');
      INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,lifecycle_state) VALUES('${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.location}','${I.slot}','COMPLETED',NULL);
      INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES('${I.visit}','${I.appointment}','${I.hold}','${I.owner}','${I.pet}','${I.clinic}','${I.location}','${I.slot}','${I.vet}');
      INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,file_name,mime_type) VALUES('${I.document}','${I.pet}','${I.owner}','private-source','HISTORY','PROCESSED','history.pdf','application/pdf'),('${I.otherDocument}','${I.pet}','${I.owner}','private-source','HISTORY','PROCESSED','unshared.pdf','application/pdf');`);
    const clinical = `/v1/clinic/visits/${I.visit}/results`;
    const draft = await request(app.getHttpServer()).post(clinical).set('Authorization', `Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({clinicalSummary:'Owner-selected historical result'});
    expect(draft.status).toBe(201); result=draft.body.id;
    expect((await request(app.getHttpServer()).post(`${clinical}/${result}/publish`).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('If-Match','1').set('X-Correlation-ID',randomUUID())).status).toBe(200);
    await mkdir(fixtureDirectory,{recursive:true});await writeFile(documentStorage.petDocumentStoragePath(fixtureKey),bytes);
    await db.query('UPDATE pet_schema.pet_documents SET storage_key=$2,file_size_bytes=$3 WHERE id=$1',[I.document,fixtureKey,bytes.length]);
  });
  afterAll(async () => { await app?.close();await rm(fixtureDirectory,{recursive:true,force:true}); });
  afterEach(async () => { await revokeAll(); });

  it('Document byte delivery returns private verified bytes and preserves Owner download',async()=>{
    expect((await grant(selected())).status).toBe(201);const response=await download();expect(response.status).toBe(200);expect(response.body).toEqual(bytes);
    expect(response.headers['content-type']).toBe('application/pdf');expect(response.headers['content-length']).toBe(String(bytes.length));expect(response.headers['content-disposition']).toContain('attachment; filename="history.pdf"');expect(response.headers['cache-control']).toBe('private, no-store');expect(response.headers['x-content-type-options']).toBe('nosniff');
    // Pilot intentionally does not publish the legacy Owner download route. Verify its unchanged service authority instead.
    const owned=await app.get(OwnerPetService).downloadDocument({sub:I.owner,roles:[Role.OWNER],clinicIds:[],locationIds:[]},I.pet,I.document);const chunks:Buffer[]=[];for await(const chunk of owned.stream)chunks.push(Buffer.from(chunk));expect(Buffer.concat(chunks)).toEqual(bytes);
    const audit=(await db.query(`SELECT payload_json FROM audit_schema.audit_log WHERE action='medical.document.content.read' AND aggregate_id=$1`,[I.document])).rows;
    expect(audit).toHaveLength(1);expect(JSON.stringify(audit)).not.toMatch(/Private acceptance|storage_key|wave4a-test|file_name|file_url|clinicalSummary/);
  });
  it('Document byte denial normalizes missing/unshared/foreign Owner/Pet/Clinic/Location before storage',async()=>{
    expect((await grant(selected())).status).toBe(201);
    const otherPet=randomUUID(),foreignPet=randomUUID(),sameOwnerDocument=randomUUID(),foreignDocument=randomUUID();
    await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Other','DOG'),($3,$4,'Foreign','DOG')`,[otherPet,I.owner,foreignPet,I.otherOwner]);
    await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status) VALUES($1,$2,$3,'source','HISTORY','PROCESSED'),($4,$5,$6,'source','HISTORY','PROCESSED')`,[sameOwnerDocument,otherPet,I.owner,foreignDocument,foreignPet,I.otherOwner]);
    const open=jest.spyOn(documentStorage,'openStoredPetDocument');
    try{
      for(const id of [randomUUID(),I.otherDocument,sameOwnerDocument,foreignDocument]){const response=await download(id);expect(response.status).toBe(404);expect(response.body).toEqual(denied);}
      for(const [clinics,locations] of [[[I.otherClinic],[I.otherLocation]],[[I.clinic],[I.otherLocation]]]){const response=await download(I.document,await token(I.vet,[Role.CLINIC_VETERINARIAN],clinics,locations));expect(response.status).toBe(404);expect(response.body).toEqual(denied);}
      const owner=await download(I.document,await token(I.otherOwner));expect(owner.status).toBe(403);
      expect(open).not.toHaveBeenCalled();
    }finally{open.mockRestore();}
  });
  it.each(['membership','clinic','location'])('Document bytes require active %s',async kind=>{
    expect((await grant(selected())).status).toBe(201);
    const table=kind==='membership'?'employee_location_memberships':kind==='clinic'?'clinics':'clinic_locations';const predicate=kind==='membership'?'employee_id=$1':'id=$1';const id=kind==='membership'?I.vet:kind==='clinic'?I.clinic:I.location;
    await db.query(`UPDATE clinic_schema.${table} SET ${kind==='membership'?'active=false,revoked_at=clock_timestamp()':"status='INACTIVE'"} WHERE ${predicate}`,[id]);
    const open=jest.spyOn(documentStorage,'openStoredPetDocument');
    try{const response=await download();expect(response.status).toBe(404);expect(response.body).toEqual(denied);expect(open).not.toHaveBeenCalled();}
    finally{open.mockRestore();await db.query(`UPDATE clinic_schema.${table} SET ${kind==='membership'?'active=true,revoked_at=NULL':"status='ACTIVE'"} WHERE ${predicate}`,[id]);}
  });
  it.each([Role.CLINIC_ADMIN,Role.CLINIC_RECEPTIONIST])('Document bytes deny %s even with grant',async role=>{
    expect((await grant(selected())).status).toBe(201);const open=jest.spyOn(documentStorage,'openStoredPetDocument');
    try{const response=await download(I.document,await token(role===Role.CLINIC_ADMIN?I.admin:I.reception,[role],[I.clinic],[I.location]));expect(response.status).toBe(403);expect(open).not.toHaveBeenCalled();}finally{open.mockRestore();}
  });
  it('Document bytes deny revoked/deleted/unavailable source with no success audit',async()=>{
    const before=(await db.query(`SELECT count(*)::int n FROM audit_schema.audit_log WHERE aggregate_id=$1 AND action='medical.document.content.read'`,[I.document])).rows[0].n;
    const created=await grant(selected());expect(created.status).toBe(201);expect((await revoke(created.body.id)).status).toBe(200);
    const open=jest.spyOn(documentStorage,'openStoredPetDocument');
    try{const response=await download();expect(response.status).toBe(404);expect(response.body).toEqual(denied);expect(open).not.toHaveBeenCalled();}finally{open.mockRestore();}
    expect((await grant(selected())).status).toBe(201);await db.query('UPDATE pet_schema.pet_documents SET deleted_at=clock_timestamp() WHERE id=$1',[I.document]);
    try{expect((await download()).body).toEqual(denied);}finally{await db.query('UPDATE pet_schema.pet_documents SET deleted_at=NULL WHERE id=$1',[I.document]);}
    await db.query('UPDATE pet_schema.pet_documents SET storage_key=$2 WHERE id=$1',[I.document,'missing-source.pdf']);
    try{const response=await download();expect(response.status).toBe(404);expect(response.body).toEqual(denied);}finally{await db.query('UPDATE pet_schema.pet_documents SET storage_key=$2 WHERE id=$1',[I.document,fixtureKey]);}
    expect((await db.query(`SELECT count(*)::int n FROM audit_schema.audit_log WHERE aggregate_id=$1 AND action='medical.document.content.read'`,[I.document])).rows[0].n).toBe(before);
  });

  it.each([false,true])('Document stream closes and audit rolls back when audit/COMMIT fails (deferred=%s)',async deferred=>{
    expect((await grant(selected())).status).toBe(201);
    const before=(await db.query(`SELECT count(*)::int n FROM audit_schema.audit_log WHERE action='medical.document.content.read' AND aggregate_id=$1`,[I.document])).rows[0].n;
    const name=`w4a_fail_${randomUUID().replace(/-/g,'')}`;
    const original=documentStorage.openStoredPetDocument;let opened:Awaited<ReturnType<typeof original>>|undefined;
    const spy=jest.spyOn(documentStorage,'openStoredPetDocument').mockImplementation(async document=>{opened=await original(document);return opened;});
    await db.query(`CREATE FUNCTION audit_schema.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.aggregate_id='${I.document}' AND NEW.action='medical.document.content.read' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`);
    await db.query(deferred?`CREATE CONSTRAINT TRIGGER ${name} AFTER INSERT ON audit_schema.audit_log DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION audit_schema.${name}()`:`CREATE TRIGGER ${name} BEFORE INSERT ON audit_schema.audit_log FOR EACH ROW EXECUTE FUNCTION audit_schema.${name}()`);
    try{const response=await download();expect(response.status).toBe(500);expect(opened?.stream.destroyed).toBe(true);expect(JSON.stringify(response.body)).not.toMatch(/fixture audit|storage|Private acceptance/);expect((await db.query(`SELECT count(*)::int n FROM audit_schema.audit_log WHERE action='medical.document.content.read' AND aggregate_id=$1`,[I.document])).rows[0].n).toBe(before);}
    finally{spy.mockRestore();await db.query(`DROP TRIGGER ${name} ON audit_schema.audit_log`);await db.query(`DROP FUNCTION audit_schema.${name}()`);}
  });

  it('Clinic workspace derives canonical Appointment without exposing shared content or Owner identifiers',async()=>{
    const response=await request(app.getHttpServer()).get(`/v1/clinic/${I.clinic}/locations/${I.location}/vet/visits/${I.hold}`).set('Authorization',`Bearer ${await vet()}`);
    expect(response.status).toBe(200);expect(response.body.appointmentId).toBe(I.appointment);expect(response.body.visitId).toBe(I.visit);
    expect(Object.keys(response.body).sort()).toEqual(['holdId','clinicId','locationId','scheduledStart','scheduledEnd','status','petDisplayName','species','visitId','appointmentId'].sort());
    expect(JSON.stringify(response.body)).not.toMatch(/ownerId|clinicalSummary|Owner-selected|history.pdf|file_url|medical_history/i);
    expect((await list()).body).toEqual({appointmentId:I.appointment,status:'NOT_SHARED',resources:[]});
  });
  it('Clinic shared Result does not implicitly include separately modeled Amendments',async()=>{
    const path=`/v1/clinic/visits/${I.visit}/results/${result}/amendments`;
    const amendments=[];
    for(const content of ['First explicitly shared correction','Second explicitly shared correction']){
      const response=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({content});expect(response.status).toBe(201);amendments.push(response.body);
    }
    const original=await grant({mode:'SELECTED',resources:[{type:'RESULT',id:result}]});expect(original.status).toBe(201);
    expect((await read(amendments[0].amendmentId,'AMENDMENT')).body).toEqual(denied);
    expect((await grant({mode:'SELECTED',resources:amendments.map(item=>({type:'AMENDMENT',id:item.amendmentId}))})).status).toBe(201);
    for(const item of amendments){const response=await read(item.amendmentId,'AMENDMENT');expect(response.status).toBe(200);expect(response.body).toEqual({type:'AMENDMENT',id:item.amendmentId,content:item.content,publishedAt:item.publishedAt,version:item.version});}
    expect((await read()).body.content).toBe('Owner-selected historical result');
    expect((await request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${await token()}`)).body.shares.find((share:{id:string})=>share.id===original.body.id).resources).toEqual([{type:'RESULT',id:result}]);
  });
  it('Clinic shared published Result rejects same-pet unselected future Result substitution',async()=>{
    const amend=await request(app.getHttpServer()).post(`/v1/clinic/visits/${I.visit}/results/${result}/amendments`).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({content:'Explicit snapshot amendment'});expect(amend.status).toBe(201);
    const snapshot=[...selected().resources,{type:'AMENDMENT',id:amend.body.amendmentId}];
    const created=await grant({mode:'SELECTED',resources:snapshot});expect(created.status).toBe(201);
    const slot=randomUUID(),hold=randomUUID(),appointment=randomUUID(),visit=randomUUID();
    await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES($1,$2,$3,clock_timestamp()-interval '1 hour',clock_timestamp())`,[slot,I.location,I.service]);
    await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'COMPLETED',clock_timestamp()+interval '1 hour')`,[hold,slot,I.owner,I.pet]);
    await db.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,$6,'COMPLETED')`,[appointment,hold,I.owner,I.pet,I.location,slot]);
    await db.query(`INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[visit,appointment,hold,I.owner,I.pet,I.clinic,I.location,slot,I.vet]);
    const path=`/v1/clinic/visits/${visit}/results`;
    const draft=await request(app.getHttpServer()).post(path).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({clinicalSummary:'Unselected same-Pet published result'});expect(draft.status).toBe(201);
    expect((await request(app.getHttpServer()).post(`${path}/${draft.body.id}/publish`).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('If-Match','1').set('X-Correlation-ID',randomUUID())).status).toBe(200);
    const futureAmend=await request(app.getHttpServer()).post(`${path}/${draft.body.id}/amendments`).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({content:'Future unselected amendment'});expect(futureAmend.status).toBe(201);
    const futureDocument=randomUUID();await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status) VALUES($1,$2,$3,'source','HISTORY','PROCESSED')`,[futureDocument,I.pet,I.owner]);
    expect((await read(futureAmend.body.amendmentId,'AMENDMENT')).body).toEqual(denied);expect((await download(futureDocument)).body).toEqual(denied);
    expect((await read(amend.body.amendmentId,'AMENDMENT')).status).toBe(200);expect((await download()).body).toEqual(bytes);
    const response=await read(draft.body.id);expect(response.status).toBe(404);expect(response.body).toEqual(denied);
    expect((await read()).body.content).toBe('Owner-selected historical result');
    expect((await list()).body.resources).toEqual(expect.arrayContaining(snapshot));expect((await list()).body.resources).toHaveLength(3);
    const context=await request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${await token()}`);expect(context.body.resources).toEqual(expect.arrayContaining([{type:'RESULT',id:draft.body.id},{type:'AMENDMENT',id:futureAmend.body.amendmentId},{type:'DOCUMENT',id:futureDocument}]));expect(context.body.shares.find((share:{id:string})=>share.id===created.body.id)).toEqual(created.body);
  });

  it('Owner sharing presentation is scoped, closed and excludes medical content',async()=>{
    const fetchContext=async(auth?:string)=>request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${auth??await token()}`);
    const response=await fetchContext();expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['appointmentId','petId','clinicId','locationId','eligible','resources','resourcesTruncated','shares','clinic','pet','appointment','resourceDetails'].sort());
    expect(response.body.clinic).toEqual({displayName:'A',locationAddress:'A'});expect(response.body.pet).toEqual({displayName:'Pet'});
    expect(response.body.appointment.startsAt).toEqual(expect.any(String));expect(response.body.appointment.endsAt).toEqual(expect.any(String));expect(response.body.appointment.timezone).toEqual(expect.any(String));
    expect(response.body.resourceDetails).toEqual(expect.arrayContaining([{type:'RESULT',id:result,label:'Результат приёма',createdAt:expect.any(String)},{type:'DOCUMENT',id:I.document,label:'history.pdf',createdAt:expect.any(String)}]));
    expect(JSON.stringify(response.body)).not.toMatch(/clinicalSummary|Owner-selected historical|private-source|file_url|ocr/i);
    const other=await fetchContext(await token(I.otherOwner));expect(other.status).toBe(404);expect(other.body).toEqual(denied);
    const created=await grant({mode:'SELECTED',resources:[{type:'DOCUMENT',id:I.document}]});expect(created.status).toBe(201);
    const readback=await fetchContext();expect(readback.body.shares.find((share:{id:string})=>share.id===created.body.id)).toEqual(created.body);expect(created.body.resources).toEqual([{type:'DOCUMENT',id:I.document}]);
    const cancelled=await revoke(created.body.id);expect(cancelled.status).toBe(200);expect((await fetchContext()).body.shares.find((share:{id:string})=>share.id===created.body.id)).toEqual(cancelled.body);
  });

  it.each([Role.CLINIC_ADMIN,Role.CLINIC_RECEPTIONIST])('BP-11 truthful operational minimum without grant: %s',async role=>{
    process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY='true';
    const phone=`+1${Math.floor(Math.random()*1e10).toString().padStart(10,'0')}`;
    await db.query(`INSERT INTO identity_schema.owner_identities(user_id,phone_e164) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET phone_e164=excluded.phone_e164`,[I.owner,phone]);
    await db.query(`UPDATE pet_schema.pets SET breed='Beagle',medical_history_ocr=$2 WHERE id=$1`,[I.pet,JSON.stringify({text:'Private medical OCR marker'})]);
    const response=await request(app.getHttpServer()).get(`/v1/clinic/${I.clinic}/locations/${I.location}/appointments/${I.appointment}`).set('Authorization',`Bearer ${await token(role===Role.CLINIC_ADMIN?I.admin:I.reception,[role],[I.clinic],[I.location])}`);
    expect(response.status).toBe(200);expect(response.body.owner).toEqual({displayName:null,phone});
    expect(response.body.pet).toEqual({id:I.pet,displayName:'Pet',speciesLabel:'Собака',breed:'Beagle'});
    expect(Object.keys(response.body).sort()).toEqual(['clinicId','locationId','serverNow','appointment','schedule','owner','pet','service','veterinarian','resource','availableActions'].sort());
    expect(Object.keys(response.body.appointment).sort()).toEqual(['appointmentId','aggregateVersion','statusCode','statusLabel','createdAt'].sort());
    expect(JSON.stringify(response.body)).not.toMatch(/Private medical|Owner-selected|history\.pdf|clinicalSummary|ocr|medical|diary|amendment/i);
    expect((await list()).body.status).toBe('NOT_SHARED');expect((await read()).body).toEqual(denied);
  });
  it('BP-11 absent identity/breed are null; inactive clinic blocks operational contact',async()=>{
    process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY='true';
    await db.query('DELETE FROM identity_schema.owner_identities WHERE user_id=$1',[I.owner]);
    await db.query('UPDATE pet_schema.pets SET breed=NULL WHERE id=$1',[I.pet]);
    const invoke=async()=>request(app.getHttpServer()).get(`/v1/clinic/${I.clinic}/locations/${I.location}/appointments/${I.appointment}`).set('Authorization',`Bearer ${await token(I.admin,[Role.CLINIC_ADMIN],[I.clinic],[I.location])}`);
    const response=await invoke();expect(response.status).toBe(200);expect(response.body.owner).toEqual({displayName:null,phone:null});expect(response.body.pet.breed).toBeNull();
    await db.query("UPDATE clinic_schema.clinics SET status='INACTIVE' WHERE id=$1",[I.clinic]);
    try{const inactive=await invoke();expect(inactive.status).toBe(403);expect(inactive.body).not.toHaveProperty('owner');}
    finally{await db.query("UPDATE clinic_schema.clinics SET status='ACTIVE' WHERE id=$1",[I.clinic]);}
  });

  it('appointment alone exposes no history; missing and unshared return identical denials', async () => {
    expect((await list()).body).toEqual({appointmentId:I.appointment,status:'NOT_SHARED',resources:[]});
    for (const id of [result,randomUUID()]) expect((await read(id)).body).toEqual(denied);
  });
  it('selected Result + Document only; replay, payload conflict, immutable resources and audit', async () => {
    const key=randomUUID(), created=await grant(selected(),key); expect(created.status).toBe(201);
    expect((await grant(selected(),key)).body).toEqual(created.body);
    expect((await grant({mode:'ALL_CURRENT'},key)).body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await read()).body.content).toBe('Owner-selected historical result');
    expect((await read(I.document,'DOCUMENT')).body.fileName).toBe('history.pdf');
    expect((await read(I.otherDocument,'DOCUMENT')).body).toEqual(denied);
    await expect(db.query('DELETE FROM medical_schema.appointment_data_share_resources WHERE share_id=$1',[created.body.id])).rejects.toMatchObject({code:'23514'});
    expect((await db.query('SELECT count(*)::int n FROM medical_schema.share_events WHERE share_id=$1',[created.body.id])).rows[0].n).toBe(1);
  });
  it('current-history snapshot excludes future documents and cannot be extended', async () => {
    const created=await grant({mode:'ALL_CURRENT'}); expect(created.status).toBe(201); const future=randomUUID();
    await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status) VALUES($1,$2,$3,'source','HISTORY','PROCESSED')`,[future,I.pet,I.owner]);
    expect((await read(future,'DOCUMENT')).body).toEqual(denied);
    await expect(db.query(`INSERT INTO medical_schema.appointment_data_share_resources(share_id,owner_id,pet_id,resource_type,resource_id,document_id) VALUES($1,$2,$3,'DOCUMENT',$4,$4)`,[created.body.id,I.owner,I.pet,future])).rejects.toMatchObject({code:'23514'});
  });
  it('cross-owner, foreign resources and forged authority fields fail closed', async () => {
    expect((await grant(selected(),randomUUID(),await token(I.otherOwner))).status).toBe(404);
    expect((await grant({mode:'SELECTED',resources:[{type:'RESULT',id:randomUUID()}]})).body).toEqual(denied);
    expect((await grant({...selected(),clinicId:I.otherClinic})).status).toBe(400);
  });
  it('Owner selected snapshot A/B remains exact after eligible C appears',async()=>{
    const created=await grant(selected());expect(created.status).toBe(201);
    const future=randomUUID();
    await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status,file_name) VALUES($1,$2,$3,'source','HISTORY','PROCESSED','later.pdf')`,[future,I.pet,I.owner]);
    const response=await request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${await token()}`);expect(response.status).toBe(200);
    expect(response.body.resources).toContainEqual({type:'DOCUMENT',id:future});
    const snapshot=response.body.shares.find((share:{id:string})=>share.id===created.body.id);expect(snapshot).toEqual(created.body);expect(snapshot.resources).toHaveLength(2);
    expect(snapshot.resources).toEqual(expect.arrayContaining(selected().resources));
    expect((await read(future,'DOCUMENT')).body).toEqual(denied);
  });
  it('Owner cannot select another Owner/Pet document or a DRAFT Result',async()=>{
    const sameOwnerPet=randomUUID(),foreignPet=randomUUID(),sameOwnerDocument=randomUUID(),foreignDocument=randomUUID();
    await db.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Other Pet','DOG'),($3,$4,'Foreign Pet','CAT')`,[sameOwnerPet,I.owner,foreignPet,I.otherOwner]);
    await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status) VALUES($1,$2,$3,'source','HISTORY','PROCESSED'),($4,$5,$6,'source','HISTORY','PROCESSED')`,[sameOwnerDocument,sameOwnerPet,I.owner,foreignDocument,foreignPet,I.otherOwner]);
    // One Result per Visit is authoritative: use an independent Visit, not the published fixture.
    const draftSlot=randomUUID(),draftHold=randomUUID(),draftAppointment=randomUUID(),draftVisit=randomUUID();
    await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES($1,$2,$3,clock_timestamp()-interval '1 hour',clock_timestamp())`,[draftSlot,I.location,I.service]);
    await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'COMPLETED',clock_timestamp()+interval '1 hour')`,[draftHold,draftSlot,I.owner,I.pet]);
    await db.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$2,$3,$4,$5,$6,'COMPLETED')`,[draftAppointment,draftHold,I.owner,I.pet,I.location,draftSlot]);
    await db.query(`INSERT INTO clinical_schema.visits(id,appointment_id,booking_hold_id,owner_id,pet_id,clinic_id,location_id,slot_id,completed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[draftVisit,draftAppointment,draftHold,I.owner,I.pet,I.clinic,I.location,draftSlot,I.vet]);
    const draft=await request(app.getHttpServer()).post(`/v1/clinic/visits/${draftVisit}/results`).set('Authorization',`Bearer ${await vet()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send({clinicalSummary:'Unpublished private draft'});
    expect(draft.status).toBe(201);expect(draft.body.status).toBe('DRAFT');
    for(const resource of [{type:'DOCUMENT',id:sameOwnerDocument},{type:'DOCUMENT',id:foreignDocument},{type:'RESULT',id:draft.body.id}]){
      const response=await grant({mode:'SELECTED',resources:[resource]});expect(response.status).toBe(404);expect(response.body).toEqual(denied);
    }
    const response=await request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${await token()}`);expect(response.status).toBe(200);
    expect(response.body.resources).not.toContainEqual({type:'RESULT',id:draft.body.id});expect(response.body.shares.filter((share:{status:string})=>share.status==='ACTIVE')).toEqual([]);
    expect(JSON.stringify(response.body)).not.toMatch(/Other Pet|Foreign Pet|Unpublished private draft/);
  });
  it('only veterinarian with exact scope can read; admin/reception cannot', async () => {
    expect((await grant(selected())).status).toBe(201);
    for(const [sub,role] of [[I.admin,Role.CLINIC_ADMIN],[I.reception,Role.CLINIC_RECEPTIONIST]] as const) expect((await read(result,'RESULT',await token(sub,[role],[I.clinic],[I.location]))).status).toBe(403);
    for(const [clinics,locations] of [[[I.otherClinic],[I.otherLocation]],[[I.clinic],[I.otherLocation]],[[],[]]]) expect((await read(result,'RESULT',await token(I.vet,[Role.CLINIC_VETERINARIAN],clinics,locations))).body).toEqual(denied);
    expect((await read(result,'RESULT',await token(I.admin,[Role.CLINIC_VETERINARIAN],[I.clinic],[I.location]))).body).toEqual(denied);
  });
  it.each(['membership inactive','membership revoked','clinic inactive','location inactive'])('active authority guard: %s',async kind=>{
    expect((await grant(selected())).status).toBe(201);
    const table=kind.startsWith('membership')?'employee_location_memberships':kind.startsWith('clinic')?'clinics':'clinic_locations';
    const predicate=kind.startsWith('membership')?'employee_id=$1':'id=$1'; const id=kind.startsWith('membership')?I.vet:kind.startsWith('clinic')?I.clinic:I.location;
    const set=kind.startsWith('membership')?'active=false,revoked_at=clock_timestamp()':"status='INACTIVE'";
    await db.query(`UPDATE clinic_schema.${table} SET ${set} WHERE ${predicate}`,[id]);
    try { const response=await read(); expect(response.status).toBe(404);expect(response.body).toEqual(denied); }
    finally { await db.query(`UPDATE clinic_schema.${table} SET ${kind.startsWith('membership')?'active=true,revoked_at=NULL':"status='ACTIVE'"} WHERE ${predicate}`,[id]); }
  });
  it('revoke replay is stable; stale/concurrent commands conflict; subsequent reads denied',async()=>{
    const created=await grant(selected()); const key=randomUUID();
    expect((await revoke(created.body.id,key,2)).status).toBe(409);
    const responses=await Promise.all([revoke(created.body.id,key),revoke(created.body.id,key)]);expect(responses.map(r=>r.status)).toEqual([200,200]);expect(responses[0].body).toEqual(responses[1].body);
    expect((await read()).body).toEqual(denied);
    expect((await db.query('SELECT count(*)::int n FROM medical_schema.share_events WHERE share_id=$1',[created.body.id])).rows[0].n).toBe(2);
  });
  it('concurrent identical grant commands create one grant; failure rolls back every effect',async()=>{
    const key=randomUUID(), responses=await Promise.all([grant(selected(),key),grant(selected(),key)]);
    expect(responses.map(r=>r.status)).toEqual([201,201]);expect(responses[0].body.id).toBe(responses[1].body.id);
    const before=(await db.query('SELECT count(*)::int n FROM medical_schema.appointment_data_shares')).rows[0].n;
    await db.query(`CREATE FUNCTION medical_schema.test_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER test_fail_event BEFORE INSERT ON medical_schema.share_events FOR EACH ROW EXECUTE FUNCTION medical_schema.test_fail_event();`);
    try { expect((await grant(selected())).status).toBe(500);expect((await db.query('SELECT count(*)::int n FROM medical_schema.appointment_data_shares')).rows[0].n).toBe(before); }
    finally { await db.query('DROP TRIGGER test_fail_event ON medical_schema.share_events; DROP FUNCTION medical_schema.test_fail_event()'); }
  });
  it.each([
    ['CONFIRMED','CONFIRMED',201],['CONFIRMED','RESCHEDULE_PROPOSED',201],['COMPLETED',null,201],
    ['CANCELLED','CANCELLED_BY_USER',409],['CLINIC_CANCELLED','CANCELLED_BY_CLINIC',409],['NO_SHOW','NO_SHOW',409],
  ])('new grant eligibility %s/%s',async(status,lifecycle,expected)=>{
    const slot=randomUUID(),hold=randomUUID(),appointment=randomUUID();
    await db.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 day',clock_timestamp()+interval '2 days');
    `,[slot,I.location,I.service]);
    await db.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$2,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day')`,[hold,slot,I.owner,I.pet]);
    await db.query(`INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status,lifecycle_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[appointment,hold,I.owner,I.pet,I.location,slot,status,lifecycle]);
    const response=await request(app.getHttpServer()).post(`/v1/owner/appointments/${appointment}/medical-shares`).set('Authorization',`Bearer ${await token()}`).set('Idempotency-Key',randomUUID()).set('X-Correlation-ID',randomUUID()).send(selected());
    expect(response.status).toBe(expected);
    if(expected===201){
      await db.query(`UPDATE booking_schema.appointments SET status='CANCELLED',lifecycle_state='CANCELLED_BY_USER' WHERE id=$1`,[appointment]);
      const readAfter=await request(app.getHttpServer()).get(`/v1/clinic/appointments/${appointment}/medical-shares/resources/RESULT/${result}`).set('Authorization',`Bearer ${await vet()}`);
      expect(readAfter.status).toBe(200);
    } else expect(response.body.code).toBe('BOOKING_STATE_CONFLICT');
  });
  it('revoke/read ordering: authorized read can finish; new reads after revoke commit fail',async()=>{
    const created=await grant(selected());expect(created.status).toBe(201);
    const client=await db.pool.connect();
    try {
      await client.query('BEGIN');await client.query('SELECT id FROM medical_schema.appointment_data_shares WHERE id=$1 FOR SHARE',[created.body.id]);
      const pending=revoke(created.body.id).then(r=>r); // start HTTP request while authorized-read lock is held
      await waitForShareLock();
      expect((await read()).status).toBe(200);
      await client.query('COMMIT');expect((await pending).status).toBe(200);
      expect((await read()).status).toBe(404);
    } finally { await client.query('ROLLBACK');client.release(); }
    const second=await grant(selected());const blocker=await db.pool.connect();
    try {
      await blocker.query('BEGIN');await blocker.query('SELECT id FROM medical_schema.appointment_data_shares WHERE id=$1 FOR UPDATE',[second.body.id]);
      const pendingRead=read().then(r=>r);
      await waitForShareLock();
      await blocker.query(`UPDATE medical_schema.appointment_data_shares SET status='REVOKED',version=2,revoked_at=clock_timestamp(),revoke_idempotency_key=$2,revoke_expected_version=1 WHERE id=$1`,[second.body.id,randomUUID()]);
      await blocker.query('COMMIT');expect((await pendingRead).status).toBe(404);
    } finally { await blocker.query('ROLLBACK');blocker.release(); }
  });
  it('soft-deleted document cannot be newly shared or read through an existing grant',async()=>{
    const document=randomUUID();await db.query(`INSERT INTO pet_schema.pet_documents(id,pet_id,owner_id,file_url,doc_type,status) VALUES($1,$2,$3,'source','HISTORY','PROCESSED')`,[document,I.pet,I.owner]);
    const body={mode:'SELECTED',resources:[{type:'DOCUMENT',id:document}]};expect((await grant(body)).status).toBe(201);
    await db.query('UPDATE pet_schema.pet_documents SET deleted_at=clock_timestamp() WHERE id=$1',[document]);
    expect((await read(document,'DOCUMENT')).body).toEqual(denied);expect((await grant(body)).body).toEqual(denied);
  });
  it('more than 200 historical resources does not block an explicitly selected resource',async()=>{
    await db.query(`INSERT INTO pet_schema.pet_documents(pet_id,owner_id,file_url,doc_type,status) SELECT $1,$2,'source','HISTORY','PROCESSED' FROM generate_series(1,201)`,[I.pet,I.owner]);
    const context=await request(app.getHttpServer()).get(ownerPath).set('Authorization',`Bearer ${await token()}`);
    expect(context.status).toBe(200);expect(context.body.resourcesTruncated).toBe(true);expect(context.body.resources).toHaveLength(200);
    expect((await grant(selected())).status).toBe(201);
    expect((await grant({mode:'ALL_CURRENT'})).status).toBe(400);
  });
});
