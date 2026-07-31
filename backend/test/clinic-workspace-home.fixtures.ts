import { DatabaseService } from '../src/database/database.service';

export const WORKSPACE_IDS = {
  owner: '81000000-0000-4000-8000-000000000001',
  receptionist: '81000000-0000-4000-8000-000000000002',
  admin: '81000000-0000-4000-8000-000000000003',
  veterinarian: '81000000-0000-4000-8000-000000000004',
  revoked: '81000000-0000-4000-8000-000000000005',
  noMembership: '81000000-0000-4000-8000-000000000006',
  inactive: '81000000-0000-4000-8000-000000000007',
  clinic: '82000000-0000-4000-8000-000000000001',
  otherClinic: '82000000-0000-4000-8000-000000000002',
  location: '83000000-0000-4000-8000-000000000001',
  otherLocation: '83000000-0000-4000-8000-000000000002',
  otherClinicLocation: '83000000-0000-4000-8000-000000000003',
  pet: '84000000-0000-4000-8000-000000000001',
  queueSlot: '85000000-0000-4000-8000-000000000001',
  appointmentSlot: '85000000-0000-4000-8000-000000000002',
  queueHold: '86000000-0000-4000-8000-000000000001',
  appointmentHold: '86000000-0000-4000-8000-000000000002',
  appointment: '87000000-0000-4000-8000-000000000001',
} as const;

export async function resetWorkspaceFixtures(database: DatabaseService): Promise<void> {
  const id = WORKSPACE_IDS;
  await database.query('TRUNCATE clinic_schema.clinics, pet_schema.pets, identity_schema.users CASCADE');
  await database.query('TRUNCATE booking_schema.outbox_events, booking_schema.idempotency_records, audit_schema.audit_log');
  await database.query('INSERT INTO identity_schema.users (id) SELECT unnest($1::uuid[])', [[id.owner, id.receptionist, id.admin, id.veterinarian, id.revoked, id.noMembership, id.inactive]]);
  await database.query(`INSERT INTO clinic_schema.clinics (id, legal_name, public_name, timezone) VALUES ($1, 'Workspace LLC', 'Workspace', 'Europe/Moscow'), ($2, 'Other LLC', 'Other', 'UTC')`, [id.clinic, id.otherClinic]);
  await database.query(`INSERT INTO clinic_schema.clinic_locations (id, clinic_id, address) VALUES ($1,$2,'Main'),($3,$2,'Other'),($4,$5,'Foreign')`, [id.location, id.clinic, id.otherLocation, id.otherClinicLocation, id.otherClinic]);
  await database.query(`
    INSERT INTO clinic_schema.employee_location_memberships (employee_id, clinic_location_id, role, active, revoked_at)
    VALUES ($1,$2,'CLINIC_RECEPTIONIST',true,NULL),($3,$2,'CLINIC_ADMIN',true,NULL),
           ($4,$2,'CLINIC_VETERINARIAN',true,NULL),($5,$2,'CLINIC_RECEPTIONIST',false,clock_timestamp()),
           ($6,$2,'CLINIC_RECEPTIONIST',false,clock_timestamp()),($7,$2,'CLINIC_RECEPTIONIST',true,NULL)
  `, [id.receptionist, id.location, id.admin, id.veterinarian, id.revoked, id.inactive, id.owner]);
  await database.query(`INSERT INTO pet_schema.pets (id, owner_id, name, species) VALUES ($1,$2,'Private pet','DOG')`, [id.pet, id.owner]);
  await database.query(`
    INSERT INTO clinic_schema.appointment_slots (id, clinic_location_id, starts_at, ends_at, capacity, held_count, booked_count, state, status, integration_mode)
    VALUES
      ($1,$2,clock_timestamp()+interval '30 minutes',clock_timestamp()+interval '60 minutes',1,1,0,'OPEN','LOCKED_BY_HOLD','LEVEL_C'),
      ($3,$2,clock_timestamp()+interval '90 minutes',clock_timestamp()+interval '120 minutes',1,0,1,'OPEN','BOOKED','LEVEL_C')
  `, [id.queueSlot, id.location, id.appointmentSlot]);
  await database.query(`
    INSERT INTO booking_schema.booking_holds (id,slot_id,owner_id,pet_id,state,expires_at,state_changed_at,confirmation_sla_expires_at)
    VALUES ($1,$2,$3,$4,'MANUAL_CONFIRM_PENDING',clock_timestamp()+interval '1 hour',clock_timestamp()-interval '7 minutes',clock_timestamp()+interval '3 minutes'),
           ($5,$6,$3,$4,'CONFIRMED',clock_timestamp()+interval '1 day',clock_timestamp()-interval '1 day',NULL)
  `, [id.queueHold, id.queueSlot, id.owner, id.pet, id.appointmentHold, id.appointmentSlot]);
  await database.query(`
    INSERT INTO booking_schema.appointments (id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status)
    VALUES ($1,$2,$3,$4,$5,$6,'CONFIRMED')
  `, [id.appointment, id.appointmentHold, id.owner, id.pet, id.location, id.appointmentSlot]);
}

export async function workspaceOperationalFingerprint(database: DatabaseService): Promise<Record<string, string>> {
  const result = await database.query<Record<string, string>>(`
    SELECT (SELECT COUNT(*) FROM booking_schema.booking_holds)::text AS holds,
           (SELECT COALESCE(SUM(version),0) FROM booking_schema.booking_holds)::text AS hold_versions,
           (SELECT COUNT(*) FROM booking_schema.appointments)::text AS appointments,
           (SELECT COALESCE(SUM(version),0) FROM booking_schema.appointments)::text AS appointment_versions,
           (SELECT COUNT(*) FROM booking_schema.outbox_events)::text AS outbox,
           (SELECT COUNT(*) FROM audit_schema.audit_log)::text AS audit
  `);
  return result.rows[0];
}
