import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {DatabaseService} from '../src/database/database.service';
import {ClinicScheduleService} from '../src/booking-core/clinic-schedule.service';
import {ClinicEmployeeAccessService} from '../src/booking-core/clinic-employee-access.service';
import {Role} from '../src/auth/auth.types';
const run=process.env.SYNTHETIC_IMPORT_TEST==='true'?describe:describe.skip;
run('Synthetic publication uses native Schedule transaction and actor-scoped idempotency',()=>{
 let db:DatabaseService,service:ClinicScheduleService,client:any,clinicId:string,locationId:string,serviceId:string,employee:any;
 beforeAll(async()=>{
  if(new URL(process.env.DATABASE_URL!).pathname!=='/synthetic_multiclinic_v4')throw Error('Exclusive test DB required');
  db=new DatabaseService();client=await db.pool.connect();await client.query('BEGIN');
  const row=(await client.query(`SELECT c.id clinic_id,l.id location_id,s.id service_id,m.employee_id FROM clinic_schema.clinics c JOIN clinic_schema.clinic_locations l ON l.clinic_id=c.id JOIN clinic_schema.clinic_services s ON s.clinic_location_id=l.id JOIN clinic_schema.employee_location_memberships m ON m.clinic_location_id=l.id AND m.role='CLINIC_ADMIN' LIMIT 1`)).rows[0];
  clinicId=row.clinic_id;locationId=row.location_id;serviceId=row.service_id;
  employee={sub:row.employee_id,roles:[Role.CLINIC_ADMIN],clinicIds:[clinicId],locationIds:[locationId]};
  // Outer real PostgreSQL transaction rolls back only these test-owned additions.
  service=new ClinicScheduleService({withTransaction:async(fn:any)=>fn(client)} as DatabaseService,new ClinicEmployeeAccessService());
 });
 afterAll(async()=>{if(client){await client.query('ROLLBACK');client.release();}await db?.onModuleDestroy();});
 const input=()=>({clinicId,locationId,employee,idempotencyKey:randomUUID(),correlationId:randomUUID(),slots:[{serviceId,startsAt:new Date(Date.now()+3*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000+2700000).toISOString(),capacity:1}]});
 it('distinct publication batches both create a durable outbox/audit candidate',async()=>{const before=Number((await client.query("SELECT count(*) FROM booking_schema.outbox_events WHERE event_type='clinic.schedule.import.completed.v1' AND aggregate_id=$1",[locationId])).rows[0].count);for(let i=0;i<2;i++)expect((await service.importManualSlots(input())).imported).toBe(1);const after=Number((await client.query("SELECT count(*) FROM booking_schema.outbox_events WHERE event_type='clinic.schedule.import.completed.v1' AND aggregate_id=$1",[locationId])).rows[0].count);expect(after-before).toBe(2);});
 it('exact replay does not create more slots or overwrite counters',async()=>{const x=input(),first=await service.importManualSlots(x);await client.query('UPDATE clinic_schema.appointment_slots SET held_count=1,version=version+1 WHERE id=$1',[first.slots[0].id]);expect(await service.importManualSlots(x)).toEqual(first);expect((await client.query('SELECT held_count FROM clinic_schema.appointment_slots WHERE id=$1',[first.slots[0].id])).rows[0].held_count).toBe(1);});
 it('different authorized actors may use the same command UUID',async()=>{const id=randomUUID();await client.query('INSERT INTO identity_schema.users(id) VALUES($1)',[id]);await client.query("INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES($1,$2,'CLINIC_ADMIN')",[id,locationId]);const x=input();await service.importManualSlots(x);expect((await service.importManualSlots({...x,employee:{...employee,sub:id}})).imported).toBe(1);});
 it('forged tenant fails before publishing anything',async()=>{await expect(service.importManualSlots({...input(),clinicId:randomUUID()})).rejects.toMatchObject({status:403});});
});
