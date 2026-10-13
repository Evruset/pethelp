import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {DatabaseService} from '../src/database/database.service';
import {ClinicScheduleService} from '../src/booking-core/clinic-schedule.service';
import {ClinicEmployeeAccessService} from '../src/booking-core/clinic-employee-access.service';
import {Role} from '../src/auth/auth.types';
const run=process.env.DOCTOR_SHIFT_TEST==='true'?describe:describe.skip;
run('DoctorShift native database integrity and bounded domain publication',()=>{
 let db:DatabaseService,service:ClinicScheduleService,base:Date,employee:any;
 const clinic=randomUUID(),location=randomUUID(),foreignLocation=randomUUID(),doctor=randomUUID(),foreignDoctor=randomUUID(),staff=randomUUID(),foreignStaff=randomUUID(),actor=randomUUID();
 const shift=(offset=0)=>({id:randomUUID(),doctorId:doctor,staffId:staff,startsAt:new Date(base.getTime()+offset*86400000).toISOString(),endsAt:new Date(base.getTime()+offset*86400000+3600000).toISOString(),externalShiftId:randomUUID()});
 const input=(shifts=[shift()])=>({clinicId:clinic,locationId:location,employee,source:'INTEGRATION_TEST',idempotencyKey:randomUUID(),correlationId:randomUUID(),shifts});
 beforeAll(async()=>{
  if(new URL(process.env.DATABASE_URL!).pathname!=='/synthetic_multiclinic_v4_r_74f0e1d2c3b4')throw Error('Exclusive fresh DoctorShift test database required');
  db=new DatabaseService();service=new ClinicScheduleService(db,new ClinicEmployeeAccessService());
  await db.withTransaction(async c=>{
   if(Number((await c.query('SELECT count(*) FROM clinic_schema.doctor_shifts')).rows[0].count))throw Error('Fresh DoctorShift fixture required');
   await c.query('INSERT INTO identity_schema.users(id) VALUES($1)',[actor]);
   await c.query("INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone,booking_contract_profile) VALUES($1,'SHIFT INTEGRATION TEST','SHIFT INTEGRATION TEST','ACTIVE','Europe/Moscow','MVP_V1_MANUAL')",[clinic]);
   for(const id of [location,foreignLocation])await c.query("INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status) VALUES($1,$2,'TEST ONLY','ACTIVE')",[id,clinic]);
   await c.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active) VALUES($1,$2,'CLINIC_ADMIN',true)",[actor,location]);
   const specialty=randomUUID();await c.query("INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'Shift integration','SHIFT_TEST')",[specialty]);
   for(const [id,loc] of [[doctor,location],[foreignDoctor,foreignLocation]])await c.query("INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id) VALUES($1,$2,'TEST DOCTOR',$3)",[id,loc,specialty]);
   for(const [id,loc] of [[staff,location],[foreignStaff,foreignLocation]])await c.query("INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role) VALUES($1::uuid,$2,$1::text,'TEST STAFF','VETERINARIAN')",[id,loc]);
   base=(await c.query("SELECT date_trunc('day',clock_timestamp()+interval '30 days')+interval '9 hours' base")).rows[0].base;
  });employee={sub:actor,roles:[Role.CLINIC_ADMIN],clinicIds:[clinic],locationIds:[location]};
 });
 afterAll(async()=>db?.onModuleDestroy());
 const totals=async()=> (await db.query(`SELECT (SELECT count(*)::int FROM clinic_schema.doctor_shifts) shifts,(SELECT count(*)::int FROM clinic_schema.appointment_slots) slots,(SELECT count(*)::int FROM booking_schema.outbox_events WHERE event_type='clinic.schedule.doctor_shifts.imported.v1') events,(SELECT count(*)::int FROM audit_schema.audit_log WHERE action='clinic.schedule.doctor_shifts.imported') audits`)).rows[0];
 const insert=(s:ReturnType<typeof shift>,loc=location)=>db.query('INSERT INTO clinic_schema.doctor_shifts(id,clinic_location_id,doctor_id,staff_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6)',[s.id,loc,s.doctorId,s.staffId,s.startsAt,s.endsAt]);
 it('publishes adjacent half-open shifts atomically with one audit/outbox and no slots',async()=>{const a=shift(),b={...shift(),startsAt:a.endsAt,endsAt:new Date(Date.parse(a.endsAt)+3600000).toISOString()};const before=await totals();expect((await service.importDoctorShifts(input([a,b]))).imported).toBe(2);const after=await totals();expect(after).toEqual({shifts:before.shifts+2,slots:before.slots,events:before.events+1,audits:before.audits+1});});
 it('replays exact input and rejects changed payload with the same idempotency key',async()=>{const x=input([shift(2)]),first=await service.importDoctorShifts(x),before=await totals();expect(await service.importDoctorShifts(x)).toEqual(first);await expect(service.importDoctorShifts({...x,shifts:[{...x.shifts[0],endsAt:new Date(Date.parse(x.shifts[0].endsAt)+60000).toISOString()}]})).rejects.toMatchObject({status:409});expect(await totals()).toEqual(before);});
 it('rejects invalid durations and cross-location doctor/staff at database boundary',async()=>{await expect(insert({...shift(3),endsAt:shift(3).startsAt})).rejects.toMatchObject({code:'23514'});await expect(insert({...shift(3),doctorId:foreignDoctor})).rejects.toMatchObject({code:'23503'});await expect(insert({...shift(3),staffId:foreignStaff})).rejects.toMatchObject({code:'23503'});});
 it('rejects overlap with a committed published shift',async()=>{await expect(insert({...shift(),startsAt:new Date(base.getTime()+1800000).toISOString()})).rejects.toMatchObject({code:'23P01'});});
 it('serializes concurrent publications to one accepted shift and one audit/outbox',async()=>{const a=input([shift(4)]),b=input([shift(4)]),before=await totals();const result=await Promise.allSettled([service.importDoctorShifts(a),service.importDoctorShifts(b)]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(result.filter(r=>r.status==='rejected')).toHaveLength(1);const after=await totals();expect(after).toEqual({shifts:before.shifts+1,slots:before.slots,events:before.events+1,audits:before.audits+1});});
 it('rolls back a partially inserted batch on foreign staff without orphan effects',async()=>{const a=shift(5),before=await totals();await expect(service.importDoctorShifts(input([a,{...shift(6),staffId:foreignStaff}]))).rejects.toBeDefined();expect((await db.query('SELECT id FROM clinic_schema.doctor_shifts WHERE id=$1',[a.id])).rowCount).toBe(0);expect(await totals()).toEqual(before);});
 it('rejects foreign scope, veterinarian substitution and oversized batches',async()=>{const before=await totals();await expect(service.importDoctorShifts({...input([shift(7)]),locationId:foreignLocation})).rejects.toMatchObject({status:403});await expect(service.importDoctorShifts({...input([shift(7)]),employee:{...employee,roles:[Role.CLINIC_VETERINARIAN]}})).rejects.toMatchObject({status:403});await expect(service.importDoctorShifts(input(Array.from({length:51},()=>shift(7))))).rejects.toMatchObject({status:400});expect(await totals()).toEqual(before);});
 it('reads exact location inventory with explicit timezone and no internal provenance leakage',async()=>{const result=await service.listSlots({clinicId:clinic,locationId:location,employee,from:new Date(base.getTime()-3600000).toISOString(),to:new Date(base.getTime()+8*86400000).toISOString()});expect(result.timezone).toBe('Europe/Moscow');expect(result.doctorShifts.length).toBeGreaterThan(0);for(const s of result.doctorShifts){expect(s.doctor.id).toBe(doctor);expect(s.staff.id).toBe(staff);expect(Object.keys(s).sort()).toEqual(['doctor','endsAt','id','staff','startsAt','status']);}expect(result.slots).toEqual([]);await expect(service.listSlots({clinicId:clinic,locationId:foreignLocation,employee,from:base.toISOString(),to:new Date(base.getTime()+86400000).toISOString()})).rejects.toMatchObject({status:403});});
});
