import { randomUUID } from 'node:crypto';
import { Role } from '../src/auth/auth.types';
import { DoctorShiftInventoryService } from '../src/booking-core/doctor-shift-inventory.service';
import { BookingHoldCreationService } from '../src/booking-core/booking-hold-creation.service';
import { BookingRepository } from '../src/booking-core/booking.repository';
import { BookingSecurityService } from '../src/booking-core/booking-security.service';
import { ClinicQueueService } from '../src/booking-core/clinic-queue.service';
import { DatabaseService } from '../src/database/database.service';
import { PublicCatalogService } from '../src/public-catalog/public-catalog.service';

jest.setTimeout(45_000);

describe('Wave 3 DoctorShift generated inventory (real PostgreSQL)', () => {
  const database = new DatabaseService();
  const access = { assertScheduleManageAccess: jest.fn(), assertScheduleReadAccess: jest.fn() } as never;
  const inventory = new DoctorShiftInventoryService(database, access);
  const catalog = new PublicCatalogService(database);
  const booking = new BookingHoldCreationService(database, new BookingRepository());
  const clinicAccess = { assertBookingDecisionCapability: jest.fn(), assertBookingDecisionAccess: jest.fn(), assertBookingQueueReadAccess: jest.fn() } as never;
  const bookingDecision = new BookingSecurityService(database, clinicAccess);
  const queue = new ClinicQueueService(database, clinicAccess);
  const ids = { clinic: randomUUID(), location: randomUUID(), service: randomUUID(), specialty: randomUUID(), doctor: randomUUID(), staff: randomUUID(), employee: randomUUID(), owner: randomUUID(), pet: randomUUID() };
  const actor = { sub: ids.employee, roles: [Role.CLINIC_ADMIN], clinicIds: [ids.clinic], locationIds: [ids.location] };

  beforeAll(async () => {
    await database.query(`INSERT INTO identity_schema.users(id) VALUES($1),($2)`, [ids.employee, ids.owner]);
    await database.query(`INSERT INTO pet_schema.pets(id,owner_id,name,species) VALUES($1,$2,'Wave3 Pet','DOG')`, [ids.pet, ids.owner]);
    await database.query(`INSERT INTO clinic_schema.clinics(id,legal_name,public_name,status,timezone) VALUES($1,'Wave3 legal','Wave3 clinic','ACTIVE','Europe/Moscow')`, [ids.clinic]);
    await database.query(`INSERT INTO clinic_schema.clinic_locations(id,clinic_id,address,status,timezone) VALUES($1,$2,'Wave3 address','ACTIVE','Europe/Moscow')`, [ids.location, ids.clinic]);
    await database.query(`INSERT INTO catalog_schema.specialties(id,name,code) VALUES($1,'Wave3 specialty',$2)`, [ids.specialty, `W3_${ids.specialty.replaceAll('-', '')}`]);
    await database.query(`INSERT INTO catalog_schema.doctors(id,clinic_location_id,full_name,specialty_id,active,public_booking_enabled) VALUES($1,$2,'Wave3 Doctor',$3,true,true)`, [ids.doctor, ids.location, ids.specialty]);
    await database.query(`INSERT INTO clinic_schema.clinic_staff(id,clinic_location_id,code,display_name,role,active,catalog_doctor_id) VALUES($1,$2,$3,'Wave3 Doctor','VETERINARIAN',true,$4)`, [ids.staff, ids.location, `w3_${ids.staff.replaceAll('-', '')}`, ids.doctor]);
    await database.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Wave3 Service',30,true,1000,'RUB')`, [ids.service, ids.location, `w3_${ids.service.replaceAll('-', '')}`]);
    await inventory.createDoctorService({ clinicId: ids.clinic, locationId: ids.location, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), staffId: ids.staff, doctorId: ids.doctor, serviceId: ids.service, resourceId: null });
  });

  afterAll(async () => {
    await database.query(`DELETE FROM booking_schema.outbox_events WHERE producer='doctor-shift-inventory' AND aggregate_id IN (SELECT id FROM clinic_schema.inventory_generation_runs WHERE doctor_shift_id IN (SELECT id FROM clinic_schema.doctor_shifts WHERE clinic_id=$1))`, [ids.clinic]);
    await database.query(`DELETE FROM booking_schema.idempotency_records WHERE scope LIKE $1`, [`%:${ids.employee}`]);
    await database.query(`DELETE FROM booking_schema.idempotency_records WHERE scope=$1`, [`booking.create-local-hold:${ids.owner}`]);
    await database.query(`DELETE FROM booking_schema.owner_notification_email_deliveries WHERE recipient_owner_id=$1`, [ids.owner]);
    await database.query(`DELETE FROM booking_schema.owner_notifications WHERE recipient_owner_id=$1`, [ids.owner]);
    await database.query(`DELETE FROM booking_schema.appointment_events WHERE hold_id IN (SELECT id FROM booking_schema.booking_holds WHERE owner_id=$1)`, [ids.owner]);
    await database.query(`DELETE FROM booking_schema.appointments WHERE owner_id=$1`, [ids.owner]);
    await database.query(`DELETE FROM booking_schema.booking_holds WHERE owner_id=$1`, [ids.owner]);
    await database.query(`DELETE FROM clinic_schema.schedule_periods WHERE clinic_location_id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.appointment_slots WHERE clinic_location_id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.inventory_generation_runs WHERE doctor_shift_id IN (SELECT id FROM clinic_schema.doctor_shifts WHERE clinic_id=$1)`, [ids.clinic]);
    await database.query(`DELETE FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`, [ids.clinic]);
    await database.query(`DELETE FROM clinic_schema.doctor_services WHERE clinic_location_id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.clinic_services WHERE clinic_location_id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.clinic_resources WHERE clinic_location_id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.clinic_staff WHERE id=$1`, [ids.staff]);
    await database.query(`DELETE FROM catalog_schema.doctors WHERE id=$1`, [ids.doctor]);
    await database.query(`DELETE FROM catalog_schema.specialties WHERE id=$1`, [ids.specialty]);
    await database.query(`DELETE FROM clinic_schema.clinic_locations WHERE id=$1`, [ids.location]);
    await database.query(`DELETE FROM clinic_schema.clinics WHERE id=$1`, [ids.clinic]);
    await database.query(`DELETE FROM pet_schema.pets WHERE id=$1`, [ids.pet]);
    await database.query(`DELETE FROM identity_schema.users WHERE id=ANY($1::uuid[])`, [[ids.employee, ids.owner]]);
    await database.onModuleDestroy();
  });

  it('generates stable draft slots, publishes only that run, and unpublishes without deleting lineage', async () => {
    const anchor = new Date(Date.now() + 3 * 86_400_000); anchor.setUTCMinutes(0, 0, 0);
    const shift = await inventory.createShift({ clinicId: ids.clinic, locationId: ids.location, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), staffId: ids.staff, doctorId: ids.doctor, startsAt: anchor.toISOString(), endsAt: new Date(anchor.getTime() + 2 * 3_600_000).toISOString() });
    await database.query(`INSERT INTO clinic_schema.schedule_periods(clinic_location_id,period_type,starts_at,ends_at,staff_id,active) VALUES($1,'BLACKOUT',$2,$3,$4,true)`, [ids.location, new Date(anchor.getTime()+30*60_000), new Date(anchor.getTime()+60*60_000), ids.staff]);
    const key = randomUUID();
    const run = await inventory.generate({ clinicId: ids.clinic, locationId: ids.location, shiftId: shift.id, employee: actor, idempotencyKey: key, correlationId: randomUUID(), expectedVersion: shift.version });
    expect(run).toMatchObject({ status: 'GENERATED', slotCount: 3, generationVersion: 1 });
    const replay = await inventory.generate({ clinicId: ids.clinic, locationId: ids.location, shiftId: shift.id, employee: actor, idempotencyKey: key, correlationId: run.rulesFingerprint.slice(0, 8) + '-0000-4000-8000-000000000000', expectedVersion: shift.version });
    expect(replay.id).toBe(run.id);
    expect((await catalog.readOwnerAvailability(ids.clinic, ids.location, ids.service))?.slots).toEqual([]);

    const published = await inventory.publish({ clinicId: ids.clinic, locationId: ids.location, runId: run.id, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID() });
    expect(published).toMatchObject({ publicationState: 'PUBLISHED', slotCount: 3 });
    const visible = await catalog.readOwnerAvailability(ids.clinic, ids.location, ids.service);
    expect(visible?.slots).toHaveLength(3);
    expect(visible?.slots[0]).not.toHaveProperty('generationRunId');

    await inventory.unpublish({ clinicId: ids.clinic, locationId: ids.location, runId: run.id, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID() });
    expect((await catalog.readOwnerAvailability(ids.clinic, ids.location, ids.service))?.slots).toEqual([]);
    await inventory.publish({ clinicId: ids.clinic, locationId: ids.location, runId: run.id, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID() });

    const selected = visible!.slots[0];
    await expect(booking.createLocalHold({ slotId: selected.slotId, ownerId: ids.owner, petId: ids.pet, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedSlotVersion: selected.expectedVersion, clinicId: ids.clinic, locationId: ids.location, serviceId: ids.service })).rejects.toMatchObject({status:409,response:{code:'BOOKING_STATE_CONFLICT'}});
    const refreshed=(await catalog.readOwnerAvailability(ids.clinic,ids.location,ids.service))!.slots.find((slot)=>slot.slotId===selected.slotId)!;
    const hold = await booking.createLocalHold({ slotId: refreshed.slotId, ownerId: ids.owner, petId: ids.pet, idempotencyKey: randomUUID(), correlationId: randomUUID(), expectedSlotVersion: refreshed.expectedVersion, clinicId: ids.clinic, locationId: ids.location, serviceId: ids.service, doctorId: null });
    expect(hold).toMatchObject({ status: 'PENDING_CONFIRMATION', confirmationMode: 'MANUAL' });
    expect((await queue.listManualConfirmationQueue({clinicId:ids.clinic,locationId:ids.location,employee:actor,limit:50})).items.map((item)=>item.holdId)).toContain(hold.holdId);
    const confirmed=await bookingDecision.confirmManualHold({holdId:hold.holdId,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:1});
    expect(confirmed.state).toBe('CONFIRMED');

    await expect(inventory.unpublish({ clinicId: ids.clinic, locationId: ids.location, runId: run.id, employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID() })).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_HAS_ACTIVE_BOOKINGS'}});
    expect((await catalog.readOwnerAvailability(ids.clinic, ids.location, ids.service))?.slots).toHaveLength(2);
    expect((await database.query<{ count: string }>(`SELECT count(*)::text count FROM booking_schema.booking_holds WHERE id=$1`, [hold.holdId])).rows[0].count).toBe('1');
    const persisted = await database.query<{ count: string; min_capacity: number; max_capacity: number; lineage: string }>(`SELECT count(*)::text count,min(capacity) min_capacity,max(capacity) max_capacity,count(doctor_shift_id)::text lineage FROM clinic_schema.appointment_slots WHERE generation_run_id=$1`, [run.id]);
    expect(persisted.rows[0]).toEqual({ count: '3', min_capacity: 1, max_capacity: 1, lineage: '3' });
  });

  it('projects only eligible specialist-first doctors with live published inventory and stable identities',async()=>{
    await database.query(`UPDATE clinic_schema.clinic_locations SET latitude=55.755800,longitude=37.617300 WHERE id=$1`,[ids.location]);
    const serviceRow=(await database.query<{code:string}>(`SELECT code FROM clinic_schema.clinic_services WHERE id=$1`,[ids.service])).rows[0];
    const first=await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,serviceCode:serviceRow.code.toUpperCase(),limit:25});
    const options=await catalog.readOwnerSpecialistDiscoveryOptions();
    expect(options.specialties).toContainEqual({specialtyId:ids.specialty,name:'Wave3 specialty'});
    expect(options.services).toContainEqual({serviceCode:serviceRow.code.toUpperCase(),name:'Wave3 Service'});
    expect(first.doctors).toHaveLength(1);
    expect(first.doctors[0]).toMatchObject({specialtyId:ids.specialty,doctorId:ids.doctor,serviceId:ids.service,clinicId:ids.clinic,locationId:ids.location,latitude:55.7558,longitude:37.6173});
    expect(Object.keys(first.doctors[0]).sort()).toEqual(['address','clinicId','clinicName','doctorId','doctorName','latitude','locationId','longitude','serviceCode','serviceId','serviceName','slots','specialtyId','specialtyName','timezone']);
    expect(first.doctors[0].slots).toHaveLength(2);
    expect(first.doctors[0].slots).toEqual([...first.doctors[0].slots].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.slotId.localeCompare(b.slotId)));
    expect((await catalog.readOwnerSpecialistDiscovery({serviceCode:'WRONG_SERVICE',limit:25})).doctors).toEqual([]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:randomUUID(),limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE clinic_schema.clinic_locations SET latitude=NULL,longitude=NULL WHERE id=$1`,[ids.location]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors[0]).toMatchObject({locationId:ids.location,latitude:null,longitude:null});
    await database.query(`UPDATE clinic_schema.clinic_locations SET latitude=55.755800,longitude=37.617300 WHERE id=$1`,[ids.location]);

    const stable=await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:1});
    expect(stable.doctors).toHaveLength(1);
    expect(stable.doctors.map(({slots,...doctor})=>({...doctor,slots:slots.map(({startsAt,endsAt,...slot})=>slot)})))
      .toEqual(first.doctors.slice(0,1).map(({slots,...doctor})=>({...doctor,slots:slots.map(({startsAt,endsAt,...slot})=>slot)})));

    const visibleSlot=first.doctors[0].slots[0].slotId;
    await database.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',blocked_at=clock_timestamp(),published_at=NULL,unpublished_at=NULL,source_stale_at=NULL WHERE id=$1`,[visibleSlot]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors[0].slots.map(slot=>slot.slotId)).not.toContain(visibleSlot);
    await database.query(`UPDATE clinic_schema.appointment_slots SET state='OPEN',publication_state='PUBLISHED',blocked_at=NULL,published_at=clock_timestamp(),unpublished_at=NULL,source_stale_at=NULL WHERE id=$1`,[visibleSlot]);

    await database.query(`UPDATE clinic_schema.doctor_services SET active=false WHERE doctor_id=$1 AND service_id=$2`,[ids.doctor,ids.service]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE clinic_schema.doctor_services SET active=true WHERE doctor_id=$1 AND service_id=$2`,[ids.doctor,ids.service]);
    await database.query(`UPDATE catalog_schema.doctors SET active=false WHERE id=$1`,[ids.doctor]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE catalog_schema.doctors SET active=true WHERE id=$1`,[ids.doctor]);
    await database.query(`UPDATE catalog_schema.doctors SET public_booking_enabled=false WHERE id=$1`,[ids.doctor]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE catalog_schema.doctors SET public_booking_enabled=true WHERE id=$1`,[ids.doctor]);
    await database.query(`UPDATE clinic_schema.clinic_staff SET active=false WHERE id=$1`,[ids.staff]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE clinic_schema.clinic_staff SET active=true WHERE id=$1`,[ids.staff]);
    await database.query(`UPDATE clinic_schema.clinic_locations SET status='INACTIVE' WHERE id=$1`,[ids.location]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE clinic_schema.clinic_locations SET status='ACTIVE' WHERE id=$1`,[ids.location]);
    await database.query(`UPDATE clinic_schema.clinics SET status='INACTIVE' WHERE id=$1`,[ids.clinic]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors).toEqual([]);
    await database.query(`UPDATE clinic_schema.clinics SET status='ACTIVE' WHERE id=$1`,[ids.clinic]);

    const draftStart=new Date(Date.now()+8*86_400_000);draftStart.setUTCMinutes(0,0,0);
    const resource=randomUUID();
    await database.query(`INSERT INTO clinic_schema.clinic_resources(id,clinic_location_id,code,display_name,active) VALUES($1,$2,$3,'W4A cabinet',true)`,[resource,ids.location,`w4a_${resource.replaceAll('-','')}`]);
    await inventory.createDoctorService({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,serviceId:ids.service,resourceId:resource});
    const draftShift=await inventory.createShift({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,startsAt:draftStart.toISOString(),endsAt:new Date(draftStart.getTime()+60*60_000).toISOString()});
    const draftRun=await inventory.generate({clinicId:ids.clinic,locationId:ids.location,shiftId:draftShift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:draftShift.version});
    const draftSlots=(await database.query<{id:string}>(`SELECT id FROM clinic_schema.appointment_slots WHERE generation_run_id=$1`,[draftRun.id])).rows.map(row=>row.id);
    const afterDraft=await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25});
    expect(afterDraft.doctors.flatMap(doctor=>doctor.slots.map(slot=>slot.slotId))).not.toEqual(expect.arrayContaining(draftSlots));
    await inventory.publish({clinicId:ids.clinic,locationId:ids.location,runId:draftRun.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID()});
    const resourceSlots=(await database.query<{id:string}>(`SELECT id FROM clinic_schema.appointment_slots WHERE generation_run_id=$1 AND resource_id=$2 ORDER BY id`,[draftRun.id,resource])).rows.map(row=>row.id);
    const withTwoEligibilities=await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25});
    expect(withTwoEligibilities.doctors).toHaveLength(1);
    const visibleResourceSlots=withTwoEligibilities.doctors[0].slots.map(slot=>slot.slotId).filter(slotId=>resourceSlots.includes(slotId));
    expect(visibleResourceSlots.length).toBeGreaterThan(0);
    await database.query(`UPDATE clinic_schema.clinic_resources SET active=false WHERE id=$1`,[resource]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors[0].slots.map(slot=>slot.slotId).filter(slotId=>resourceSlots.includes(slotId))).toEqual([]);
    await database.query(`UPDATE clinic_schema.clinic_resources SET active=true WHERE id=$1`,[resource]);

    const originalShift=(await database.query<{doctor_shift_id:string}>(`SELECT doctor_shift_id FROM clinic_schema.appointment_slots WHERE id=$1`,[visibleSlot])).rows[0].doctor_shift_id;
    const mismatched=visibleResourceSlots[0];
    await database.query(`UPDATE clinic_schema.appointment_slots SET doctor_shift_id=$2 WHERE id=$1`,[mismatched,originalShift]);
    expect((await catalog.readOwnerSpecialistDiscovery({specialtyId:ids.specialty,limit:25})).doctors[0].slots.map(slot=>slot.slotId)).not.toContain(mismatched);
    await database.query(`UPDATE clinic_schema.appointment_slots SET doctor_shift_id=$2 WHERE id=$1`,[mismatched,draftShift.id]);
    await database.query(`UPDATE clinic_schema.doctor_services SET active=false WHERE resource_id=$1`,[resource]);
  });

  it('normalizes overlapping shifts to a deterministic conflict', async () => {
    const existing=(await inventory.list({clinicId:ids.clinic,locationId:ids.location,employee:actor,from:new Date().toISOString(),to:new Date(Date.now()+10*86_400_000).toISOString()})).shifts[0];
    await expect(inventory.createShift({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,startsAt:existing.startsAt,endsAt:existing.endsAt})).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_OVERLAP'}});
  });

  it('rejects invalid, reversed and over-24-hour intervals without effects',async()=>{
    const before=(await database.query<{count:string}>(`SELECT count(*)::text count FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`,[ids.clinic])).rows[0].count;
    const base={clinicId:ids.clinic,locationId:ids.location,employee:actor,staffId:ids.staff,doctorId:ids.doctor,idempotencyKey:randomUUID(),correlationId:randomUUID()};
    await expect(inventory.createShift({...base,startsAt:'2026-02-30T10:00',endsAt:'2026-02-30T11:00'})).rejects.toMatchObject({status:409});
    await expect(inventory.createShift({...base,idempotencyKey:randomUUID(),startsAt:'2026-09-10T12:00',endsAt:'2026-09-10T09:00'})).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_INTERVAL_INVALID'}});
    await expect(inventory.createShift({...base,idempotencyKey:randomUUID(),startsAt:'2026-09-10T09:00',endsAt:'2026-09-11T10:00'})).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_INTERVAL_INVALID'}});
    expect((await database.query<{count:string}>(`SELECT count(*)::text count FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`,[ids.clinic])).rows[0].count).toBe(before);
  });

  it('serializes concurrent generation into one run and one logical slot set',async()=>{
    const startsAt=new Date(Date.now()+5*86_400_000);startsAt.setUTCMinutes(0,0,0);
    const shift=await inventory.createShift({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+2*3_600_000).toISOString()});
    const results=await Promise.all([0,1].map(()=>inventory.generate({clinicId:ids.clinic,locationId:ids.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:shift.version})));
    expect(new Set(results.map((item)=>item.id)).size).toBe(1);
    const persisted=await database.query<{runs:string;slots:string}>(`SELECT count(DISTINCT run.id)::text runs,count(slot.id)::text slots FROM clinic_schema.inventory_generation_runs run LEFT JOIN clinic_schema.appointment_slots slot ON slot.generation_run_id=run.id WHERE run.doctor_shift_id=$1`,[shift.id]);
    expect(persisted.rows[0]).toEqual({runs:'1',slots:'4'});
  });

  it('fences an old run after shift edit and regenerates from the new version',async()=>{
    const startsAt=new Date(Date.now()+6*86_400_000);startsAt.setUTCMinutes(0,0,0);
    const shift=await inventory.createShift({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+2*3_600_000).toISOString()});
    const oldRun=await inventory.generate({clinicId:ids.clinic,locationId:ids.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:shift.version});
    const updated=await inventory.updateShift({clinicId:ids.clinic,locationId:ids.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:shift.version,startsAt:new Date(startsAt.getTime()+30*60_000).toISOString(),endsAt:new Date(startsAt.getTime()+150*60_000).toISOString()});
    await expect(inventory.publish({clinicId:ids.clinic,locationId:ids.location,runId:oldRun.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID()})).rejects.toMatchObject({status:409,response:{code:'INVENTORY_SOURCE_STALE'}});
    expect((await database.query<{count:string}>(`SELECT count(*)::text count FROM clinic_schema.appointment_slots WHERE generation_run_id=$1 AND state='CLOSED' AND publication_state='STALE_SOURCE'`,[oldRun.id])).rows[0].count).toBe('4');
    const fresh=await inventory.generate({clinicId:ids.clinic,locationId:ids.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:updated.version});
    expect(fresh.shiftVersion).toBe(updated.version);
    expect(fresh.id).not.toBe(oldRun.id);
  });

  it('blocks and cancels free inventory but rejects both with a protected booking',async()=>{
    const all=await inventory.list({clinicId:ids.clinic,locationId:ids.location,employee:actor,from:new Date().toISOString(),to:new Date(Date.now()+10*86_400_000).toISOString()});
    const protectedShift=all.shifts.find((item)=>item.status==='PUBLISHED')!;
    await expect(inventory.block({clinicId:ids.clinic,locationId:ids.location,shiftId:protectedShift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:protectedShift.version})).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_HAS_ACTIVE_BOOKINGS'}});
    await expect(inventory.cancel({clinicId:ids.clinic,locationId:ids.location,shiftId:protectedShift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:protectedShift.version})).rejects.toMatchObject({status:409,response:{code:'DOCTOR_SHIFT_HAS_ACTIVE_BOOKINGS'}});
    const free=all.shifts.find((item)=>item.status==='DRAFT'&&item.id!==protectedShift.id)!;
    const cancelled=await inventory.cancel({clinicId:ids.clinic,locationId:ids.location,shiftId:free.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:free.version});
    expect(cancelled.status).toBe('CANCELLED');
    expect((await database.query<{count:string}>(`SELECT count(*)::text count FROM clinic_schema.appointment_slots WHERE doctor_shift_id=$1 AND state<>'CLOSED'`,[free.id])).rows[0].count).toBe('0');
  });

  it('generates more than 500 deterministic candidates within the interactive bound', async () => {
    const secondService=randomUUID();
    await database.query(`UPDATE clinic_schema.clinic_services SET duration_minutes=5 WHERE id=$1`,[ids.service]);
    await database.query(`INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active,price_amount,currency) VALUES($1,$2,$3,'Wave3 Fast Service',5,true,500,'RUB')`,[secondService,ids.location,`w3_${secondService.replaceAll('-','')}`]);
    await inventory.createDoctorService({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,serviceId:secondService,resourceId:null});
    const startsAt=new Date(Date.now()+7*86_400_000); startsAt.setUTCMinutes(0,0,0);
    const shift=await inventory.createShift({clinicId:ids.clinic,locationId:ids.location,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),staffId:ids.staff,doctorId:ids.doctor,startsAt:startsAt.toISOString(),endsAt:new Date(startsAt.getTime()+24*3_600_000).toISOString()});
    const before=Date.now();
    const run=await inventory.generate({clinicId:ids.clinic,locationId:ids.location,shiftId:shift.id,employee:actor,idempotencyKey:randomUUID(),correlationId:randomUUID(),expectedVersion:shift.version});
    expect(run.slotCount).toBe(576);
    expect(Date.now()-before).toBeLessThan(2_000);
  });

  it('rejects a foreign location with zero shift effects', async () => {
    const before = await database.query<{ count: string }>(`SELECT count(*)::text count FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`, [ids.clinic]);
    await expect(inventory.createShift({ clinicId: ids.clinic, locationId: randomUUID(), employee: actor, idempotencyKey: randomUUID(), correlationId: randomUUID(), staffId: ids.staff, doctorId: ids.doctor, startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 5 * 86_400_000 + 3_600_000).toISOString() })).rejects.toMatchObject({ status: 404 });
    expect((await database.query<{ count: string }>(`SELECT count(*)::text count FROM clinic_schema.doctor_shifts WHERE clinic_id=$1`, [ids.clinic])).rows[0]).toEqual(before.rows[0]);
  });
});
