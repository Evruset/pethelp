import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { PublicCatalogService } from '../src/public-catalog/public-catalog.service';

jest.setTimeout(30_000);
describe('Owner clinic catalog PostgreSQL projection',()=>{
  const db=new DatabaseService(); const service=new PublicCatalogService(db); const clinics:string[]=[]; const locations:string[]=[];
  afterAll(async()=>{if(locations.length){await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.clinic_services WHERE clinic_location_id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.clinic_locations WHERE id=ANY($1::uuid[])',[locations]);await db.query('DELETE FROM clinic_schema.clinics WHERE id=ANY($1::uuid[])',[clinics]);}await db.onModuleDestroy();});

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
  });

  it('reads the exact active clinic/location service projection without availability or payment state',async()=>{
    const active=await fixture('Карточка','Адрес карточки');
    await db.query("UPDATE clinic_schema.clinic_services SET display_name='Осмотр Б',price_amount=1250.00,currency='RUB' WHERE clinic_location_id=$1",[active.location]);
    const second=randomUUID();await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Осмотр А',30,true,900.50,'RUB')",[second,active.location,`S_${second.replaceAll('-','')}`]);
    const inactive=randomUUID();await db.query("INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Скрытая услуга',30,false,500.00,'RUB')",[inactive,active.location,`S_${inactive.replaceAll('-','')}`]);
    const result=await service.readOwnerClinicServices(active.clinic,active.location);
    expect(result).toEqual(expect.objectContaining({clinicId:active.clinic,locationId:active.location,name:'Карточка',address:'Адрес карточки',services:[expect.objectContaining({name:'Осмотр А',price:{kind:'INFORMATIONAL',amount:'900.50',currency:'RUB'}}),expect.objectContaining({name:'Осмотр Б',price:{kind:'INFORMATIONAL',amount:'1250.00',currency:'RUB'}})]}));
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

  it('projects bounded server-time availability from shared slots and live capacity',async()=>{
    const active=await fixture('Доступность','Адрес availability');
    const serviceRow=await db.query<{id:string}>('SELECT id FROM clinic_schema.clinic_services WHERE clinic_location_id=$1 LIMIT 1',[active.location]);const serviceId=serviceRow.rows[0].id;
    await db.query('DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1',[active.location]);
    const past=randomUUID(),free=randomUUID(),partial=randomUUID(),held=randomUUID(),booked=randomUUID(),closed=randomUUID(),far=randomUUID();
    const insert=async(id:string,offset:string,state='OPEN',heldCount=0,bookedCount=0,capacity=1)=>db.query("INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,state,version,publication_state,blocked_at) VALUES($1,$2,$3,clock_timestamp()+($4::text)::interval,clock_timestamp()+($4::text)::interval+interval '30 minutes',$8,$5,$6,$7,3,CASE WHEN $7='OPEN' THEN 'PUBLISHED' ELSE 'BLOCKED' END,CASE WHEN $7='OPEN' THEN NULL ELSE clock_timestamp() END)",[id,active.location,serviceId,offset,heldCount,bookedCount,state,capacity]);
    await insert(past,'-1 hour');await insert(free,'1 day');await insert(partial,'1 day 12 hours','OPEN',1,1,3);await insert(held,'2 days','OPEN',1);await insert(booked,'3 days','OPEN',0,1);await insert(closed,'4 days','CLOSED');await insert(far,'15 days');
    const before=await db.query('SELECT id,held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1 ORDER BY id',[active.location]);
    const result=await service.readOwnerAvailability(active.clinic,active.location,serviceId);
    expect(result?.slots.map(slot=>slot.slotId)).toEqual([free,partial]);expect(result?.slots[0]).toEqual(expect.objectContaining({expectedVersion:3,localDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),localTime:expect.stringMatching(/^\d{2}:\d{2}$/)}));
    expect(Object.keys(result!.slots[0]).sort()).toEqual(['endsAt','expectedVersion','localDate','localTime','slotId','startsAt']);
    expect((await db.query('SELECT id,held_count,booked_count,version FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1 ORDER BY id',[active.location])).rows).toEqual(before.rows);
    expect(Object.keys(result??{}).sort()).toEqual(['clinicName','horizonEndsAt','observedAt','serviceName','slots','timezone']);
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
    if(options.slot!==false)await db.query("INSERT INTO clinic_schema.appointment_slots(clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,state,publication_state,blocked_at) VALUES($1,$2,clock_timestamp()+($3::text)::interval,clock_timestamp()+($4::text)::interval,1,$5,$6,CASE WHEN $6='OPEN' THEN 'PUBLISHED' ELSE 'BLOCKED' END,CASE WHEN $6='OPEN' THEN NULL ELSE clock_timestamp() END)",[location,serviceId,options.past?'-2 hours':'1 day',options.past?'-1 hour':'1 day 30 minutes',options.full?1:0,options.slotState??'OPEN']);
    return {clinic,location};
  }
});
