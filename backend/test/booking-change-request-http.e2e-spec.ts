import 'reflect-metadata';
import type {INestApplication} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {JwtService} from '@nestjs/jwt';
import {createHash, randomUUID} from 'node:crypto';
import request from 'supertest';
import {Role} from '../src/auth/auth.types';
import {BookingErrorFilter} from '../src/common/booking-error.filter';
import {config} from '../src/config';
import {DatabaseService} from '../src/database/database.service';
import {NestRoot} from '../src/nest-root-full';
import {NotificationFoundationRepository} from '../src/notifications/notification-foundation.repository';

jest.setTimeout(90_000);

const I={owner:'13000000-0000-4000-8000-000000000001',foreign:'13000000-0000-4000-8000-000000000002',support:'13000000-0000-4000-8000-000000000003',support2:'13000000-0000-4000-8000-000000000004',clinic:'23000000-0000-4000-8000-000000000001',location:'33000000-0000-4000-8000-000000000001',pet:'43000000-0000-4000-8000-000000000001',foreignPet:'43000000-0000-4000-8000-000000000002',service:'53000000-0000-4000-8000-000000000001',slot:'63000000-0000-4000-8000-000000000001',secondSlot:'63000000-0000-4000-8000-000000000002',foreignSlot:'63000000-0000-4000-8000-000000000003',hold:'73000000-0000-4000-8000-000000000001',secondHold:'73000000-0000-4000-8000-000000000002',foreignHold:'73000000-0000-4000-8000-000000000003'};

describe('BookingChangeRequest HTTP contract (real PostgreSQL)',()=>{
  let app:INestApplication; let database:DatabaseService; let jwt:JwtService;let notifications:NotificationFoundationRepository;
  beforeAll(async()=>{process.env.WORKERS_ENABLED='false';app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();database=app.get(DatabaseService);jwt=app.get(JwtService);notifications=app.get(NotificationFoundationRepository);});
  beforeEach(async()=>seed(database)); afterAll(async()=>app?.close());
  const token=(sub:string,roles:Role[])=>jwt.signAsync({sub,roles},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
  const create=async(holdId:string,type:'CANCEL'|'RESCHEDULE',key=randomUUID(),sub=I.owner)=>request(app.getHttpServer()).post(`/v1/owner/bookings/${holdId}/change-requests`).set('Authorization',`Bearer ${await token(sub,[Role.OWNER])}`).set('Idempotency-Key',key).send({requestType:type});
  const command=async(requestId:string,action:'start'|'complete'|'reject'|'cancel',version:number,key=randomUUID(),sub=I.support,body:Record<string,unknown>={})=>request(app.getHttpServer()).post(`/v1/operations/booking-change-requests/${requestId}/${action}`).set('Authorization',`Bearer ${await token(sub,[Role.SUPPORT_L1])}`).set('Idempotency-Key',key).set('If-Match',String(version)).send(body);

  it('creates both request types idempotently without mutating booking inventory and writes append-only evidence',async()=>{
    const before=await snapshot(database,I.hold,I.slot);
    const dbBefore=(await database.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
    const key=randomUUID(); const first=await create(I.hold,'CANCEL',key);
    expect(first.status).toBe(201); expect(first.body).toMatchObject({requestType:'CANCEL',status:'OPEN',bookingHoldId:I.hold,clinicId:I.clinic,locationId:I.location,slotId:I.slot,version:1,terminalAt:null});
    expect(await create(I.hold,'CANCEL',key).then(r=>r.body)).toEqual(first.body);
    expect((await create(I.secondHold,'CANCEL',key)).status).toBe(409);
    expect((await create(I.hold,'RESCHEDULE')).status).toBe(409);
    expect(await snapshot(database,I.hold,I.slot)).toEqual(before);
    const dbAfter=(await database.query<{now:Date}>('SELECT clock_timestamp() now')).rows[0].now;
    expect(new Date(first.body.createdAt).getTime()).toBeGreaterThanOrEqual(dbBefore.getTime()); expect(new Date(first.body.createdAt).getTime()).toBeLessThanOrEqual(dbAfter.getTime());
    expect((await database.query(`SELECT count(*)::int count FROM booking_schema.booking_change_requests WHERE booking_hold_id=$1`,[I.hold])).rows[0].count).toBe(1);
    expect((await database.query(`SELECT count(*)::int count FROM audit_schema.audit_log WHERE aggregate_type='booking_change_request' AND aggregate_id=$1`,[first.body.requestId])).rows[0].count).toBe(1);
    expect((await database.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE aggregate_type='booking_change_request' AND aggregate_id=$1`,[first.body.requestId])).rows[0].count).toBe(1);
    await database.query(`UPDATE booking_schema.booking_change_requests SET status='COMPLETED',terminal_at=clock_timestamp(),state_changed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`,[first.body.requestId]);
    expect((await create(I.hold,'RESCHEDULE')).status).toBe(201);

    const processingKey=randomUUID();
    await database.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint) VALUES($1,$2,'PROCESSING',$3)`,[`booking.change-request:${I.owner}:CANCEL`,processingKey,fingerprint(I.secondHold,'CANCEL')]);
    const processing=await create(I.secondHold,'CANCEL',processingKey); expect(processing.status).toBe(425); expect(processing.body.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    const orphanKey=randomUUID();
    await database.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,response_status,response_body,request_fingerprint) VALUES($1,$2,'COMPLETED',201,$3::jsonb,$4)`,[`booking.change-request:${I.owner}:CANCEL`,orphanKey,JSON.stringify({requestId:randomUUID()}),fingerprint(I.secondHold,'CANCEL')]);
    const orphan=await create(I.secondHold,'CANCEL',orphanKey); expect(orphan.status).toBe(409); expect(orphan.body.code).toBe('IDEMPOTENCY_REPLAY_ORPHANED');
  });

  it('provides owner-safe current readback, no-leak not-found, and a bounded Operations-safe queue',async()=>{
    const created=await create(I.hold,'RESCHEDULE'); expect(created.status).toBe(201);
    const ownerToken=await token(I.owner,[Role.OWNER]);
    const current=await request(app.getHttpServer()).get(`/v1/owner/bookings/${I.hold}/change-requests/current`).set('Authorization',`Bearer ${ownerToken}`);
    expect(current.status).toBe(200); expect(current.body.requestId).toBe(created.body.requestId);
    const foreign=await request(app.getHttpServer()).get(`/v1/owner/bookings/${I.foreignHold}/change-requests/current`).set('Authorization',`Bearer ${ownerToken}`);
    const absent=await request(app.getHttpServer()).get(`/v1/owner/bookings/${randomUUID()}/change-requests/current`).set('Authorization',`Bearer ${ownerToken}`);
    expect(foreign.status).toBe(404); expect(foreign.body).toEqual(absent.body);
    expect((await request(app.getHttpServer()).get('/v1/operations/booking-change-requests').set('Authorization',`Bearer ${ownerToken}`)).status).toBe(403);
    const ops=await request(app.getHttpServer()).get('/v1/operations/booking-change-requests?limit=1').set('Authorization',`Bearer ${await token(I.support,[Role.SUPPORT_L1])}`);
    expect(ops.status).toBe(200); expect(ops.body.items).toHaveLength(1); expect(new Date(ops.body.observedAt).toString()).not.toBe('Invalid Date');
    expect(ops.body.items[0]).not.toHaveProperty('ownerId'); expect(ops.body.items[0]).not.toHaveProperty('petId'); expect(ops.body.items[0]).not.toHaveProperty('correlationId');
    expect((await request(app.getHttpServer()).get('/v1/operations/booking-change-requests?limit=51').set('Authorization',`Bearer ${await token(I.support,[Role.SUPPORT_L1])}`)).status).toBe(400);
    expect((await create('invalid','CANCEL')).status).toBe(400);
  });

  it('fences and idempotently transitions only request lifecycle while preserving Booking, Appointment, and capacity',async()=>{
    const created=await create(I.hold,'RESCHEDULE'); expect(created.status).toBe(201);
    const detail=await request(app.getHttpServer()).get(`/v1/operations/booking-change-requests/${created.body.requestId}`).set('Authorization',`Bearer ${await token(I.support,[Role.SUPPORT_L1])}`);
    expect(detail.status).toBe(200); expect(detail.body).toMatchObject({status:'OPEN',currentBookingStatus:'CONFIRMED',currentAppointmentStatus:'CONFIRMED'});
    expect(detail.body).not.toHaveProperty('ownerId'); expect(detail.body).not.toHaveProperty('petId'); expect(detail.body).not.toHaveProperty('phone'); expect(detail.body).not.toHaveProperty('email');
    const firstKey=randomUUID(); const [claim1,claim2]=await Promise.all([command(created.body.requestId,'start',1,firstKey),command(created.body.requestId,'start',1,randomUUID(),I.support2)]);
    expect([claim1.status,claim2.status].sort()).toEqual([200,409]);
    const claimed=claim1.status===200?claim1:claim2;
    expect(claimed.body).toMatchObject({status:'PROCESSING',version:2});
    if(claim1.status===200)expect((await command(created.body.requestId,'start',1,firstKey)).body).toEqual(claim1.body);
    const stale=await command(created.body.requestId,'complete',1); expect(stale.status).toBe(409); expect(stale.body.code).toBe('BOOKING_CHANGE_REQUEST_VERSION_STALE');
    expect(claimed.body.replacementSlots).toEqual(expect.arrayContaining([expect.objectContaining({slotId:I.foreignSlot})]));
    const replacement=claimed.body.replacementSlots.find((slot:{slotId:string})=>slot.slotId===I.foreignSlot);
    const replacementStale=await command(created.body.requestId,'complete',2,randomUUID(),I.support,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version+1});expect(replacementStale.status).toBe(409);expect(replacementStale.body.code).toBe('BOOKING_CHANGE_REQUEST_REPLACEMENT_STALE');
    const processingKey1=randomUUID(),processingKey2=randomUUID();const [processing1,processing2]=await Promise.all([command(created.body.requestId,'complete',2,processingKey1,I.support,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version}),command(created.body.requestId,'complete',2,processingKey2,I.support2,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version})]);expect([processing1.status,processing2.status].sort()).toEqual([200,409]);const completed=processing1.status===200?processing1:processing2;const winnerKey=processing1.status===200?processingKey1:processingKey2;const winnerSub=processing1.status===200?I.support:I.support2;expect(completed.body).toMatchObject({status:'COMPLETED',version:3,slotId:I.foreignSlot,currentBookingStatus:'CONFIRMED',currentAppointmentStatus:'CONFIRMED'});expect((await command(created.body.requestId,'complete',2,winnerKey,winnerSub,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version})).body).toEqual(completed.body);
    expect((await snapshot(database,I.hold,I.slot)).booked_count).toBe(0);
    expect((await snapshot(database,I.hold,I.foreignSlot)).booked_count).toBe(2);
    expect((await database.query(`SELECT hold.slot_id::text hold_slot,appointment.slot_id::text appointment_slot,request.slot_id::text request_slot FROM booking_schema.booking_holds hold JOIN booking_schema.appointments appointment ON appointment.hold_id=hold.id JOIN booking_schema.booking_change_requests request ON request.booking_hold_id=hold.id WHERE hold.id=$1`,[I.hold])).rows[0]).toEqual({hold_slot:I.foreignSlot,appointment_slot:I.foreignSlot,request_slot:I.foreignSlot});
    const ownerReschedule=await request(app.getHttpServer()).get(`/v1/owner/bookings/${I.hold}/change-requests/current`).set('Authorization',`Bearer ${await token(I.owner,[Role.OWNER])}`);expect(ownerReschedule.body).toMatchObject({requestId:created.body.requestId,status:'COMPLETED',slotId:I.foreignSlot,version:3});

    const rejectedRequest=await create(I.secondHold,'CANCEL');
    expect((await command(rejectedRequest.body.requestId,'start',1)).status).toBe(200);
    const cancelKey=randomUUID();const cancelledBooking=await command(rejectedRequest.body.requestId,'complete',2,cancelKey);expect(cancelledBooking.body).toMatchObject({status:'COMPLETED',currentBookingStatus:'RELEASED',currentAppointmentStatus:'CANCELLED'});const cancelledSnapshot=await snapshot(database,I.secondHold,I.secondSlot);expect(cancelledSnapshot.booked_count).toBe(0);expect((await command(rejectedRequest.body.requestId,'complete',2,cancelKey)).body).toEqual(cancelledBooking.body);expect(await snapshot(database,I.secondHold,I.secondSlot)).toEqual(cancelledSnapshot);expect((await database.query(`SELECT count(*)::int count FROM booking_schema.outbox_events WHERE aggregate_id=$1 AND event_type='booking.hold.released.v1'`,[I.secondHold])).rows[0].count).toBe(1);expect((await database.query(`SELECT payload_json->>'reason' reason FROM booking_schema.outbox_events WHERE aggregate_id=$1 AND event_type='booking.hold.released.v1'`,[I.secondHold])).rows[0].reason).toBe('OWNER_CANCELLED');await notifications.projectPendingForOwner(I.owner);expect((await database.query(`SELECT notification_type FROM booking_schema.owner_notifications WHERE booking_hold_id=$1`,[I.secondHold])).rows[0].notification_type).toBe('CANCELLED');
    const ownerCancellation=await request(app.getHttpServer()).get(`/v1/owner/bookings/${I.secondHold}/change-requests/current`).set('Authorization',`Bearer ${await token(I.owner,[Role.OWNER])}`);expect(ownerCancellation.body).toMatchObject({requestId:rejectedRequest.body.requestId,status:'COMPLETED',slotId:I.secondSlot,version:3});
    const cancelledRequest=await create(I.foreignHold,'CANCEL',randomUUID(),I.foreign);
    expect((await command(cancelledRequest.body.requestId,'cancel',1)).body.status).toBe('CANCELLED');
    const queue=await request(app.getHttpServer()).get('/v1/operations/booking-change-requests').set('Authorization',`Bearer ${await token(I.support,[Role.SUPPORT_L1])}`);
    expect(queue.status).toBe(200); expect(queue.body.items).toHaveLength(0);
    const ownerDenied=await request(app.getHttpServer()).get(`/v1/operations/booking-change-requests/${created.body.requestId}`).set('Authorization',`Bearer ${await token(I.owner,[Role.OWNER])}`);
    const absentDenied=await request(app.getHttpServer()).get(`/v1/operations/booking-change-requests/${randomUUID()}`).set('Authorization',`Bearer ${await token(I.owner,[Role.OWNER])}`);
    expect(ownerDenied.status).toBe(403); expect(ownerDenied.body).toEqual(absentDenied.body);
  });

  it.each(['UNPUBLISHED','CONSUMED','PAST'] as const)('fails %s replacement without partial mutation',async(mode)=>{
    const created=await create(I.hold,'RESCHEDULE');const started=await command(created.body.requestId,'start',1);expect(started.status).toBe(200);const replacement=started.body.replacementSlots.find((slot:{slotId:string})=>slot.slotId===I.foreignSlot);expect(replacement).toBeDefined();const beforeSource=await snapshot(database,I.hold,I.slot);const beforeTarget=(await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0];
    if(mode==='UNPUBLISHED')await database.query(`UPDATE clinic_schema.appointment_slots SET publication_state='UNPUBLISHED',state='CLOSED',unpublished_at=clock_timestamp(),published_at=NULL WHERE id=$1`,[I.foreignSlot]);
    if(mode==='CONSUMED')await database.query(`UPDATE clinic_schema.appointment_slots SET booked_count=capacity,status='BOOKED' WHERE id=$1`,[I.foreignSlot]);
    if(mode==='PAST')await database.query(`UPDATE clinic_schema.appointment_slots SET starts_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '90 minutes' WHERE id=$1`,[I.foreignSlot]);
    const failed=await command(created.body.requestId,'complete',2,randomUUID(),I.support,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version});expect(failed.status).toBe(409);expect(failed.body.code).toBe('BOOKING_CHANGE_REQUEST_REPLACEMENT_INELIGIBLE');expect(await snapshot(database,I.hold,I.slot)).toEqual(beforeSource);expect((await database.query(`SELECT status,version FROM booking_schema.booking_change_requests WHERE id=$1`,[created.body.requestId])).rows[0]).toEqual({status:'PROCESSING',version:2});const target=(await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0];expect(target.booked_count).toBe(mode==='CONSUMED'?2:beforeTarget.booked_count);
  });

  it('does not resurrect an independently terminal Booking',async()=>{
    const created=await create(I.hold,'CANCEL');await command(created.body.requestId,'start',1);await database.query(`UPDATE booking_schema.appointments SET status='CANCELLED',version=version+1 WHERE hold_id=$1`,[I.hold]);await database.query(`UPDATE booking_schema.booking_holds SET state='RELEASED',version=version+1 WHERE id=$1`,[I.hold]);await database.query(`UPDATE clinic_schema.appointment_slots SET booked_count=booked_count-1 WHERE id=$1`,[I.slot]);const failed=await command(created.body.requestId,'complete',2);expect(failed.status).toBe(409);expect(failed.body.code).toBe('BOOKING_CHANGE_REQUEST_BOOKING_STALE');expect((await database.query(`SELECT status,version FROM booking_schema.booking_change_requests WHERE id=$1`,[created.body.requestId])).rows[0]).toEqual({status:'PROCESSING',version:2});expect((await snapshot(database,I.hold,I.slot)).booked_count).toBe(0);
  });

  it('rolls back both capacity mutations when appointment move fails mid-transaction',async()=>{
    const created=await create(I.hold,'RESCHEDULE');const started=await command(created.body.requestId,'start',1);const replacement=started.body.replacementSlots.find((slot:{slotId:string})=>slot.slotId===I.foreignSlot);const beforeSource=await snapshot(database,I.hold,I.slot);const beforeTarget=(await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0];
    await database.query(`CREATE OR REPLACE FUNCTION booking_schema.w5c1_fail_appointment_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.hold_id='${I.hold}'::uuid AND NEW.slot_id<>OLD.slot_id THEN RAISE EXCEPTION 'W5C1_INJECTED_FAILURE'; END IF; RETURN NEW; END $$`);await database.query(`CREATE TRIGGER w5c1_fail_appointment_move BEFORE UPDATE ON booking_schema.appointments FOR EACH ROW EXECUTE FUNCTION booking_schema.w5c1_fail_appointment_move()`);
    try{const failed=await command(created.body.requestId,'complete',2,randomUUID(),I.support,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version});expect(failed.status).toBe(500);expect(await snapshot(database,I.hold,I.slot)).toEqual(beforeSource);expect((await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0]).toEqual(beforeTarget);expect((await database.query(`SELECT status,version,slot_id::text FROM booking_schema.booking_change_requests WHERE id=$1`,[created.body.requestId])).rows[0]).toEqual({status:'PROCESSING',version:2,slot_id:I.slot});}finally{await database.query('DROP TRIGGER IF EXISTS w5c1_fail_appointment_move ON booking_schema.appointments');await database.query('DROP FUNCTION IF EXISTS booking_schema.w5c1_fail_appointment_move()');}
  });

  it('rolls back the full reschedule when a deferred context FK fails at commit',async()=>{
    const created=await create(I.hold,'RESCHEDULE');const started=await command(created.body.requestId,'start',1);const replacement=started.body.replacementSlots.find((slot:{slotId:string})=>slot.slotId===I.foreignSlot);const beforeSource=await snapshot(database,I.hold,I.slot);const beforeTarget=(await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0];const beforeAggregate=await processingSnapshot(database,created.body.requestId);
    await database.query(`CREATE OR REPLACE FUNCTION booking_schema.w5c1_break_deferred_context() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${created.body.requestId}'::uuid AND NEW.status='COMPLETED' AND NEW.slot_id<>OLD.slot_id THEN UPDATE booking_schema.booking_holds SET slot_id=OLD.slot_id WHERE id=NEW.booking_hold_id; END IF; RETURN NEW; END $$`);await database.query(`CREATE TRIGGER w5c1_break_deferred_context AFTER UPDATE ON booking_schema.booking_change_requests FOR EACH ROW EXECUTE FUNCTION booking_schema.w5c1_break_deferred_context()`);
    try{const failed=await command(created.body.requestId,'complete',2,randomUUID(),I.support,{replacementSlotId:I.foreignSlot,replacementSlotVersion:replacement.version});expect(failed.status).toBe(500);expect(await snapshot(database,I.hold,I.slot)).toEqual(beforeSource);expect((await database.query(`SELECT booked_count,version FROM clinic_schema.appointment_slots WHERE id=$1`,[I.foreignSlot])).rows[0]).toEqual(beforeTarget);expect(await processingSnapshot(database,created.body.requestId)).toEqual(beforeAggregate);}finally{await database.query('DROP TRIGGER IF EXISTS w5c1_break_deferred_context ON booking_schema.booking_change_requests');await database.query('DROP FUNCTION IF EXISTS booking_schema.w5c1_break_deferred_context()');}
  });
});

async function seed(database:DatabaseService){
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.booking_change_requests, booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log CASCADE');
  await database.query(`INSERT INTO identity_schema.users(id) VALUES($1),($2),($3),($4)`,[I.owner,I.foreign,I.support,I.support2]);
  await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Owner','DOG'),($3,$4,'Foreign','CAT')`,[I.pet,I.owner,I.foreignPet,I.foreign]);
  await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name) VALUES($1,'W5','W5')`,[I.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,timezone) VALUES($1,$2,'W5','Europe/Moscow')`,[I.location,I.clinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes) VALUES($1,$2,'W5','W5',30)`,[I.service,I.location]);
  await database.query(`INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,held_count,booked_count,integration_mode,state,publication_state) VALUES($1,$4,$5,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '150 minutes',1,0,1,'LEVEL_C','OPEN','PUBLISHED'),($2,$4,$5,clock_timestamp()+interval '3 hours',clock_timestamp()+interval '210 minutes',1,0,1,'LEVEL_C','OPEN','PUBLISHED'),($3,$4,$5,clock_timestamp()+interval '4 hours',clock_timestamp()+interval '270 minutes',2,0,1,'LEVEL_C','OPEN','PUBLISHED')`,[I.slot,I.secondSlot,I.foreignSlot,I.location,I.service]);
  await database.query(`INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES($1,$4,$7,$8,'CONFIRMED',clock_timestamp()+interval '1 day'),($2,$5,$7,$8,'CONFIRMED',clock_timestamp()+interval '1 day'),($3,$6,$9,$10,'CONFIRMED',clock_timestamp()+interval '1 day')`,[I.hold,I.secondHold,I.foreignHold,I.slot,I.secondSlot,I.foreignSlot,I.owner,I.pet,I.foreign,I.foreignPet]);
  await database.query(`INSERT INTO booking_schema.appointments(hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES($1,$4,$5,$6,$7,'CONFIRMED'),($2,$4,$5,$6,$8,'CONFIRMED'),($3,$9,$10,$6,$11,'CONFIRMED')`,[I.hold,I.secondHold,I.foreignHold,I.owner,I.pet,I.location,I.slot,I.secondSlot,I.foreign,I.foreignPet,I.foreignSlot]);
}

async function snapshot(database:DatabaseService,holdId:string,slotId:string){return(await database.query(`SELECT hold.state,hold.version,slot.held_count,slot.booked_count,appointment.status FROM booking_schema.booking_holds hold JOIN clinic_schema.appointment_slots slot ON slot.id=$2 JOIN booking_schema.appointments appointment ON appointment.hold_id=hold.id WHERE hold.id=$1`,[holdId,slotId])).rows[0];}
async function processingSnapshot(database:DatabaseService,requestId:string){return(await database.query(`SELECT hold.slot_id::text hold_slot,hold.version hold_version,appointment.slot_id::text appointment_slot,appointment.version appointment_version,appointment.status appointment_status,request.slot_id::text request_slot,request.status request_status,request.version request_version,(SELECT count(*)::int FROM booking_schema.appointment_events event WHERE event.appointment_id=appointment.id) appointment_events,(SELECT count(*)::int FROM audit_schema.audit_log audit WHERE audit.aggregate_id IN (hold.id,request.id)) audits,(SELECT count(*)::int FROM booking_schema.outbox_events outbox WHERE outbox.aggregate_id IN (hold.id,request.id)) outbox_events FROM booking_schema.booking_change_requests request JOIN booking_schema.booking_holds hold ON hold.id=request.booking_hold_id JOIN booking_schema.appointments appointment ON appointment.id=request.appointment_id WHERE request.id=$1`,[requestId])).rows[0];}
function fingerprint(holdId:string,requestType:string){return createHash('sha256').update(JSON.stringify({holdId,requestType})).digest('hex');}
