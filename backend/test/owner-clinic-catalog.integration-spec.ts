import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { PublicCatalogService } from '../src/public-catalog/public-catalog.service';
import { featureFlags } from '../src/config/feature-flags.config';

jest.setTimeout(30_000);
describe('Owner clinic catalog PostgreSQL projection',()=>{
  const db=new DatabaseService(); const service=new PublicCatalogService(db); const clinics:string[]=[]; const locations:string[]=[]; const doctors:string[]=[]; const consentActors:string[]=[];
  afterAll(async()=>{if(locations.length){await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=ANY($1::uuid[])',[locations]);if(featureFlags.OWNER_V50_DOCTOR_DISCOVERY){await db.query('DELETE FROM clinic_schema.inventory_generation_runs WHERE doctor_shift_id IN (SELECT id FROM clinic_schema.doctor_shifts WHERE clinic_location_id=ANY($1::uuid[]))',[locations]);await db.query('DELETE FROM clinic_schema.doctor_shifts WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.doctor_services WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('ALTER TABLE catalog_schema.doctor_public_profile_consent_events DISABLE TRIGGER doctor_public_profile_consent_audit_immutability_trigger');await db.query('DELETE FROM catalog_schema.doctor_public_profile_consent_events WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('ALTER TABLE catalog_schema.doctor_public_profile_consent_events ENABLE TRIGGER doctor_public_profile_consent_audit_immutability_trigger');await db.query('DELETE FROM clinic_schema.clinic_staff WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.employee_location_memberships WHERE clinic_location_id=ANY($1::uuid[])',[locations]);}if(doctors.length)await db.query('DELETE FROM catalog_schema.doctors WHERE id=ANY($1::uuid[])',[doctors]);await db.query('DELETE FROM clinic_schema.clinic_services WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=ANY($1::uuid[])',[clinics]);}if(consentActors.length)await db.query('DELETE FROM identity_schema.users WHERE id=ANY($1::uuid[])',[consentActors]);await db.onModuleDestroy();});

  it('returns only active future-capacity locations in deterministic order',async()=>{
    const eligibleB=await fixture('Бета','Адрес 2');
    const eligibleA=await fixture('Альфа','Адрес 1');
    const addressTwo=await fixture('Гамма','Адрес 2'); const addressOne=await fixture('Гамма','Адрес 1');
    const tieOne=await fixture('Одинаковая','Адрес'); const tieTwo=await fixture('Одинаковая','Адрес');
    await fixture('Без слота','Адрес 3',{slot:false});
    await fixture('Неактивная клиника','Адрес 4',{clinicActive:false});
    await fixture('Неактивная локация','Адрес 5',{locationActive:false});
    await fixture('Неактивная услуга','Адрес 6',{serviceActive:false});
    await fixture('Прошлый слот','Адрес 7',{past:true});
    await fixture('Заполнено','Адрес 8',{full:true});
    await fixture('Закрытый слот','Адрес 9',{slotState:'CLOSED'});
    await Promise.all(Array.from({length:51},(_,index)=>fixture(`Я лимит ${String(index).padStart(2,'0')}`,`Лимит ${index}`)));
    const result=await service.listClinicLocations({limit:50,openNow:true});
    expect(result.locations).toHaveLength(50);
    const selectedIds:string[]=[eligibleA.location,eligibleB.location];
    const selected=result.locations.filter(row=>selectedIds.includes(row.location.id));
    expect(selected.map(row=>row.clinic.name)).toEqual(['Альфа','Бета']);
    expect(result.locations.some(row=>['Без слота','Неактивная клиника','Неактивная локация','Неактивная услуга','Прошлый слот','Заполнено','Закрытый слот'].includes(row.clinic.name))).toBe(false);
    const tieIds:string[]=[tieOne.location,tieTwo.location];const ties=result.locations.filter(row=>tieIds.includes(row.location.id));expect(ties.map(row=>row.location.id)).toEqual(tieIds.sort());
    const addressIds:string[]=[addressOne.location,addressTwo.location];const addresses=result.locations.filter(row=>addressIds.includes(row.location.id));expect(addresses.map(row=>row.location.address)).toEqual(['Адрес 1','Адрес 2']);
    expect(Object.keys(selected[0].location).sort()).toEqual(['address','id','latitude','longitude','phone']);
    const eligibleService=(await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1',[eligibleA.location])).rows[0].id;
    await db.query('UPDATE clinic_schema.clinic_services SET price_amount=1250.00 WHERE id=$1',[eligibleService]);
    const cheaper=randomUUID(),inactive=randomUUID();
    await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Cheaper',30,true,900.50,'RUB'),($4,$2,$5,'Inactive',30,false,1.00,'RUB')",[cheaper,eligibleA.location,`S_${cheaper.replaceAll('-','')}`,inactive,`S_${inactive.replaceAll('-','')}`]);
    const earliest=(await db.query<{starts_at:Date}>("INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,state) VALUES($1,$2,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,'OPEN') RETURNING starts_at",[eligibleA.location,cheaper])).rows[0].starts_at;
    await db.query("INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,state) VALUES($1,$2,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '90 minutes',1,'OPEN')",[eligibleA.location,inactive]);
    const projection=await service.listOwnerClinicDecisionCatalog(50);
    expect(projection.clinics).toHaveLength(50);
    expect(projection.clinics.some(row=>['Без слота','Неактивная клиника','Неактивная локация','Неактивная услуга','Прошлый слот','Заполнено','Закрытый слот'].includes(row.name))).toBe(false);
    const projected=projection.clinics.find(row=>row.locationId===eligibleA.location)!;
    expect(projected.decisionSummary).toMatchObject({nextAvailability:{startsAt:earliest.toISOString(),localDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),localTime:expect.stringMatching(/^\d{2}:\d{2}$/),timezone:'Europe/Moscow'},informationalPrice:{kind:'FROM',amount:'900.50',currency:'RUB'},confirmation:{mode:'MANUAL'}});
    expect(Object.keys(projected).sort()).toEqual(['address','clinicId','decisionSummary','locationId','name','phone']);
  });

  it('reads the exact active clinic/location service projection without availability or payment state',async()=>{
    const active=await fixture('Карточка','Адрес карточки');
    await db.query("UPDATE clinic_schema.clinic_services SET display_name='Осмотр Б',price_amount=1250.00,currency='RUB' WHERE clinic_location_id=$1",[active.location]);
    const second=randomUUID();await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Осмотр А',30,true,900.50,'RUB')",[second,active.location,`S_${second.replaceAll('-','')}`]);
    const inactive=randomUUID();await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Скрытая услуга',30,false,500.00,'RUB')",[inactive,active.location,`S_${inactive.replaceAll('-','')}`]);
    const result=await service.readOwnerClinicServices(active.clinic,active.location);
    expect(result).toEqual(expect.objectContaining({clinicId:active.clinic,locationId:active.location,name:'Карточка',address:'Адрес карточки',services:[expect.objectContaining({name:'Осмотр А',price:{kind:'INFORMATIONAL',amount:'900.50',currency:'RUB'},specialty:null,specialists:[]}),expect.objectContaining({name:'Осмотр Б',price:{kind:'INFORMATIONAL',amount:'1250.00',currency:'RUB'},specialty:null,specialists:[]})]}));
    expect(Object.keys(result??{}).sort()).toEqual(['address','clinicId','locationId','name','observedAt','phone','services']);
    expect(result?.services.some(service=>service.serviceId===inactive)).toBe(false);
    expect(await service.readOwnerClinicServices(randomUUID(),active.location)).toBeUndefined();
    await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1',[active.location]);
    expect((await service.readOwnerClinicServices(active.clinic,active.location))?.services).toHaveLength(2);
    await db.query('DELETE FROM clinic_schema.clinic_services WHERE clinic_location_id=$1',[active.location]);
    expect((await service.readOwnerClinicServices(active.clinic,active.location))?.services).toEqual([]);
    await db.query("UPDATE clinic_schema.clinic_locations SET status='INACTIVE' WHERE id=$1",[active.location]);
    expect(await service.readOwnerClinicServices(active.clinic,active.location)).toBeUndefined();
  });

  it('does not fabricate specialist authority from a decorative doctor-bound slot',async()=>{
    const active=await fixture('Специалисты','Адрес специалистов');
    const serviceId=(await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1 LIMIT 1',[active.location])).rows[0].id;
    const specialty=(await db.query<{id:string}>('SELECT id FROM catalog_schema.specialties ORDER BY code LIMIT 1')).rows[0];
    const doctorId=randomUUID();doctors.push(doctorId);
    await db.query("INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Не публиковать',$3,true,true)",[doctorId,active.location,specialty.id]);
    await db.query('UPDATE clinic_schema.appointment_slots SET doctor_id=$2 WHERE clinic_location_id=$1',[active.location,doctorId]);
    const projected=(await service.readOwnerClinicServices(active.clinic,active.location))!.services.find(row=>row.serviceId===serviceId)!;
    expect(projected).toEqual(expect.objectContaining({specialty:null,specialists:[]}));
    expect(JSON.stringify(projected)).not.toContain('Не публиковать');
  });

  const authorityIt=featureFlags.OWNER_V50_DOCTOR_DISCOVERY?it:it.skip;
  authorityIt('projects only the bounded exact DoctorService and published DoctorShift authority',async()=>{
    const active=await fixture('Авторитетные специалисты','Адрес специалистов'),other=await fixture('Другая клиника','Другой адрес');
    const serviceId=(await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1 LIMIT 1',[active.location])).rows[0].id;
    const otherServiceId=randomUUID();await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Другая услуга',30,true,1000,'RUB')",[otherServiceId,active.location,`S_${otherServiceId.replaceAll('-','')}`]);
    const otherService=(await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1 LIMIT 1',[other.location])).rows[0].id;
    await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=ANY($1::uuid[])',[[active.location,other.location]]);
    const specialty=(await db.query<{id:string;name:string}>('SELECT id,name FROM catalog_schema.specialties ORDER BY code LIMIT 1')).rows[0];
    type Authority={doctorId:string;staffId:string;eligibilityId:string;shiftId:string;runId:string;actorId:string;locationId:string;serviceId:string};
    const addAuthority=async(name:string,options:{clinicId?:string;locationId?:string;serviceId?:string;doctorActive?:boolean;publicBooking?:boolean;staffActive?:boolean;role?:string;eligibilityActive?:boolean;shiftStatus?:string;consent?:'GRANTED'|'REVOKED'|'NONE'}={}):Promise<Authority>=>{const clinicId=options.clinicId??active.clinic,locationId=options.locationId??active.location,selectedService=options.serviceId??serviceId,doctorId=randomUUID(),staffId=randomUUID(),eligibilityId=randomUUID(),shiftId=randomUUID(),runId=randomUUID(),actorId=randomUUID();doctors.push(doctorId);consentActors.push(actorId);await db.query('INSERT INTO identity_schema.users(id) VALUES($1)',[actorId]);await db.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1,$2,'CLINIC_ADMIN')",[actorId,locationId]);await db.query('INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,$3,$4,$5,$6)',[doctorId,locationId,name,specialty.id,options.doctorActive!==false,options.publicBooking!==false]);if(options.consent!=='NONE'){await db.query("INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id,occurred_at) VALUES($1,$2,'CONSENT_GRANTED',$3,clock_timestamp()-interval '1 second')",[doctorId,locationId,actorId]);if(options.consent==='REVOKED')await db.query("INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_REVOKED',$3)",[doctorId,locationId,actorId]);}await db.query('INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[staffId,locationId,`ST_${staffId}`,name,options.role??'VETERINARIAN',options.staffActive!==false,doctorId]);await db.query('INSERT INTO clinic_schema.doctor_services(id,clinic_location_id,staff_id,doctor_id,service_id,active,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[eligibilityId,locationId,staffId,doctorId,selectedService,options.eligibilityActive!==false,actorId]);await db.query("INSERT INTO clinic_schema.doctor_shifts(id,clinic_id,clinic_location_id,staff_id,doctor_id,starts_at,ends_at,timezone,status,created_by,updated_by,generation_version) VALUES($1,$2,$3,$4,$5,clock_timestamp()-interval '2 hours',clock_timestamp()+interval '20 hours','Europe/Moscow',$6,$7,$7,1)",[shiftId,clinicId,locationId,staffId,doctorId,options.shiftStatus??'PUBLISHED',actorId]);await db.query("INSERT INTO clinic_schema.inventory_generation_runs(id,doctor_shift_id,shift_version,generation_version,rules_fingerprint,input_snapshot,status,completed_at,created_by) VALUES($1,$2,1,1,$3,'{}'::jsonb,'PUBLISHED',clock_timestamp(),$4)",[runId,shiftId,'a'.repeat(64),actorId]);return{doctorId,staffId,eligibilityId,shiftId,runId,actorId,locationId,serviceId:selectedService};};
    const addSlot=async(authority:Authority,offset:string,options:{publication?:string;full?:boolean;doctorId?:string;serviceId?:string}={})=>{const publication=options.publication??'PUBLISHED',slotId=randomUUID();await db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,staff_id,doctor_id,doctor_shift_id,doctor_service_id,generation_run_id,generation_version,duration_minutes_snapshot,starts_at,ends_at,capacity,booked_count,held_count,state,source,publication_state,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,30,clock_timestamp()+($9::text)::interval,clock_timestamp()+($9::text)::interval+interval '30 minutes',1,$10,0,'OPEN','DOCTOR_SHIFT',$11,CASE WHEN $11='PUBLISHED' THEN clock_timestamp() END)",[slotId,authority.locationId,options.serviceId??authority.serviceId,authority.staffId,options.doctorId??authority.doctorId,authority.shiftId,authority.eligibilityId,authority.runId,offset,options.full?1:0,publication]);return slotId;};
    const first=await addAuthority('Анна Первая'),second=await addAuthority('Борис Второй');const firstSlots=[await addSlot(first,'2 hours'),await addSlot(first,'3 hours')];await addSlot(second,'4 hours');
    const inactiveDoctor=await addAuthority('Неактивный врач',{doctorActive:false}),privateDoctor=await addAuthority('Непубличный врач',{publicBooking:false}),inactiveStaff=await addAuthority('Неактивный сотрудник',{staffActive:false}),wrongRole=await addAuthority('Не врач',{role:'ADMIN'}),inactiveEligibility=await addAuthority('Неактивная связь',{eligibilityActive:false}),draftShift=await addAuthority('Черновик смены',{shiftStatus:'DRAFT'}),wrongService=await addAuthority('Другая услуга',{serviceId:otherServiceId}),noConsent=await addAuthority('Нет согласия',{consent:'NONE'}),revokedConsent=await addAuthority('Отозвано согласие',{consent:'REVOKED'});
    await addSlot(inactiveDoctor,'1 hour');await addSlot(privateDoctor,'1 hour');await addSlot(inactiveStaff,'1 hour');await addSlot(wrongRole,'1 hour');await addSlot(inactiveEligibility,'1 hour');await addSlot(draftShift,'1 hour');await addSlot(wrongService,'1 hour',{serviceId:otherServiceId});await addSlot(noConsent,'1 hour');await addSlot(revokedConsent,'1 hour');await addSlot(first,'-1 hour');await addSlot(first,'30 minutes',{publication:'DRAFT'});await addSlot(first,'40 minutes',{full:true});
    const mismatchedDoctor=await addAuthority('Чужой слот');await addSlot(first,'50 minutes',{doctorId:mismatchedDoctor.doctorId});const otherClinicDoctor=await addAuthority('Чужая клиника',{clinicId:other.clinic,locationId:other.location,serviceId:otherService});await addSlot(otherClinicDoctor,'1 hour');
    const projected=(await service.readOwnerClinicServices(active.clinic,active.location))!.services.find(row=>row.serviceId===serviceId)!;
    expect(projected.specialty).toBeNull();expect(projected.specialists.map(row=>row.doctorId)).toEqual([first.doctorId,second.doctorId]);expect(projected.specialists.map(row=>row.doctorId)).not.toContain(otherClinicDoctor.doctorId);expect(projected.specialists[0]).toEqual(expect.objectContaining({displayName:'Анна Первая',specialtyName:specialty.name,nextAvailability:expect.objectContaining({startsAt:expect.any(String),localDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),localTime:expect.stringMatching(/^\d{2}:\d{2}$/),timezone:'Europe/Moscow'})}));expect(JSON.stringify(projected.specialists)).not.toMatch(/phone|email|role|capabilit|auth|active|public_booking|created_at|updated_at/i);
    expect((await service.readOwnerAvailability(active.clinic,active.location,serviceId,first.doctorId))?.slots.map(row=>row.slotId)).toEqual(firstSlots);
    expect((await service.readOwnerAvailability(active.clinic,active.location,serviceId,randomUUID()))?.slots).toEqual([]);
    await db.query("INSERT INTO catalog_schema.doctor_public_profile_consent_events(doctor_id,clinic_location_id,event_type,actor_id) VALUES($1,$2,'CONSENT_REVOKED',$3)",[second.doctorId,second.locationId,second.actorId]);
    expect((await service.readOwnerClinicServices(active.clinic,active.location))!.services.find(row=>row.serviceId===serviceId)!.specialists.map(row=>row.doctorId)).toEqual([first.doctorId]);
    const extras=[];for(let index=0;index<10;index+=1){const authority=await addAuthority(`Лимит ${String(index).padStart(2,'0')}`);await addSlot(authority,`${5+index} hours`);extras.push(authority);}
    expect((await service.readOwnerClinicServices(active.clinic,active.location))!.services.find(row=>row.serviceId===serviceId)!.specialists).toHaveLength(10);
  });

  it('projects bounded server-time availability from shared slots and live capacity',async()=>{
    const active=await fixture('Доступность','Адрес availability');
    const serviceRow=await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1 LIMIT 1',[active.location]);const serviceId=serviceRow.rows[0].id;
    await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1',[active.location]);
    const past=randomUUID(),free=randomUUID(),partial=randomUUID(),held=randomUUID(),booked=randomUUID(),closed=randomUUID(),far=randomUUID();
    const insert=async(id:string,offset:string,state='OPEN',heldCount=0,bookedCount=0,capacity=1)=>db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,state,version,publication_state,unpublished_at) VALUES($1,$2,$3,clock_timestamp()+($4::text)::interval,clock_timestamp()+($4::text)::interval+interval '30 minutes',$8,$5,$6,$7,3,$9,CASE WHEN $9='UNPUBLISHED' THEN clock_timestamp() END)",[id,active.location,serviceId,offset,heldCount,bookedCount,state,capacity,state==='OPEN'?'PUBLISHED':'UNPUBLISHED']);
    await insert(past,'-1 hour');await insert(free,'1 day');await insert(partial,'1 day 12 hours','OPEN',1,1,3);await insert(held,'2 days','OPEN',1);await insert(booked,'3 days','OPEN',0,1);await insert(closed,'4 days','CLOSED');await insert(far,'15 days');
    const before=await db.query('SELECT id,held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1 ORDER BY id',[active.location]);
    const result=await service.readOwnerAvailability(active.clinic,active.location,serviceId);
    expect(result?.slots.map(slot=>slot.slotId)).toEqual([free,partial]);expect(result?.slots[0]).toEqual(expect.objectContaining({expectedVersion:3,localDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),localTime:expect.stringMatching(/^\d{2}:\d{2}$/)}));
    expect(Object.keys(result!.slots[0]).sort()).toEqual(['endsAt','expectedVersion','localDate','localTime','slotId','startsAt']);
    expect((await db.query('SELECT id,held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1 ORDER BY id',[active.location])).rows).toEqual(before.rows);
    expect(result?.informationalPrice).toEqual({kind:'INFORMATIONAL',amount:'1000.00',currency:'RUB'});
    expect(Object.keys(result??{}).sort()).toEqual(['clinicName','horizonEndsAt','informationalPrice','observedAt','serviceName','slots','timezone']);
    await db.query('UPDATE clinic_schema.appointment_slots SET held_count=0,version=version+1 WHERE id=$1',[held]);
    expect((await service.readOwnerAvailability(active.clinic,active.location,serviceId))?.slots.map(slot=>slot.slotId)).toEqual([free,partial,held]);
    expect(await service.readOwnerAvailability(randomUUID(),active.location,serviceId)).toBeUndefined();
    expect(await service.readOwnerAvailability(active.clinic,active.location,randomUUID())).toBeUndefined();
    await db.query("UPDATE clinic_schema.clinic_services SET active=false WHERE id=$1",[serviceId]);expect(await service.readOwnerAvailability(active.clinic,active.location,serviceId)).toBeUndefined();await db.query("UPDATE clinic_schema.clinic_services SET active=true WHERE id=$1",[serviceId]);
    await db.query("UPDATE clinic_schema.clinic_locations SET status='INACTIVE' WHERE id=$1",[active.location]);expect(await service.readOwnerAvailability(active.clinic,active.location,serviceId)).toBeUndefined();await db.query("UPDATE clinic_schema.clinic_locations SET status='ACTIVE' WHERE id=$1",[active.location]);
    await db.query("UPDATE clinic_schema.clinics SET status='INACTIVE' WHERE id=$1",[active.clinic]);expect(await service.readOwnerAvailability(active.clinic,active.location,serviceId)).toBeUndefined();await db.query("UPDATE clinic_schema.clinics SET status='ACTIVE' WHERE id=$1",[active.clinic]);
    await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1',[active.location]);
    const boundedIds=Array.from({length:51},()=>randomUUID());
    await db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,state,version) SELECT id,$1,$2,anchor,anchor+interval '30 minutes',1,'OPEN',1 FROM unnest($3::uuid[]) AS id CROSS JOIN (SELECT clock_timestamp()+interval '5 days' AS anchor) t",[active.location,serviceId,boundedIds]);
    expect((await service.readOwnerAvailability(active.clinic,active.location,serviceId))?.slots.map(slot=>slot.slotId)).toEqual([...boundedIds].sort().slice(0,50));
  });

  async function fixture(name:string,address:string,options:{clinicActive?:boolean;locationActive?:boolean;serviceActive?:boolean;slot?:boolean;past?:boolean;full?:boolean;slotState?:string}={}){
    const clinic=randomUUID(),location=randomUUID(),serviceId=randomUUID();clinics.push(clinic);locations.push(location);
    await db.query('INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status) VALUES($1,$2,$2,$3)',[clinic,name,options.clinicActive===false?'INACTIVE':'ACTIVE']);
    await db.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,phone,status,timezone) VALUES($1,$2,$3,'+70000000000',$4,'Europe/Moscow')",[location,clinic,address,options.locationActive===false?'INACTIVE':'ACTIVE']);
    await db.query('INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active) VALUES($1,$2,$3,$4,30,$5)',[serviceId,location,`S_${serviceId.replaceAll('-','')}`,name,options.serviceActive!==false]);
    if(options.slot!==false){const state=options.slotState??'OPEN';await db.query("INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,state,publication_state,unpublished_at) VALUES($1,$2,clock_timestamp()+($3::text)::interval,clock_timestamp()+($4::text)::interval,1,$5,$6,$7,CASE WHEN $7='UNPUBLISHED' THEN clock_timestamp() END)",[location,serviceId,options.past?'-2 hours':'1 day',options.past?'-1 hour':'1 day 30 minutes',options.full?1:0,state,state==='OPEN'?'PUBLISHED':'UNPUBLISHED']);}
    return {clinic,location};
  }
});
