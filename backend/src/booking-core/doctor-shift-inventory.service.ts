import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { featureFlags } from '../config/feature-flags.config';
import { DomainErrors } from '../common/domain-error';

type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'BLOCKED' | 'CANCELLED';

type ShiftRow = {
  id: string; clinic_id: string; clinic_location_id: string; staff_id: string; doctor_id: string;
  starts_at: Date; ends_at: Date; timezone: string; status: ShiftStatus;
  aggregate_version: number; generation_version: number; created_at: Date; updated_at: Date;
};

@Injectable()
export class DoctorShiftInventoryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: ClinicEmployeeAccessService,
  ) {}

  async list(input: { clinicId: string; locationId: string; employee: JwtPayload; from: string; to: string }) {
    return this.database.withTransaction(async (client) => {
      await this.access.assertScheduleReadAccess(client, input.employee, input.clinicId, input.locationId);
      const location=await client.query<{timezone:string}>(`SELECT timezone FROM clinic_schema.clinic_locations WHERE id=$1::uuid AND clinic_id=$2::uuid`,[input.locationId,input.clinicId]);
      const shifts = await client.query<ShiftRow>(`
          SELECT id, clinic_id, clinic_location_id, staff_id, doctor_id, starts_at, ends_at,
                 timezone, status, aggregate_version, generation_version, created_at, updated_at
          FROM clinic_schema.doctor_shifts
          WHERE clinic_id=$1::uuid AND clinic_location_id=$2::uuid
            AND starts_at < $4::timestamptz AND ends_at > $3::timestamptz
          ORDER BY starts_at, doctor_id, id
          LIMIT 500
        `, [input.clinicId, input.locationId, input.from, input.to]);
      const services = await client.query(`
          SELECT eligibility.id, eligibility.staff_id, eligibility.doctor_id, eligibility.service_id,
                 eligibility.resource_id, eligibility.slot_capacity, eligibility.active, eligibility.version,
                 staff.display_name AS staff_name, doctor.full_name AS doctor_name,
                 service.display_name AS service_name, service.duration_minutes
          FROM clinic_schema.doctor_services eligibility
          JOIN clinic_schema.clinic_staff staff ON staff.id=eligibility.staff_id
          JOIN catalog_schema.doctors doctor ON doctor.id=eligibility.doctor_id
          JOIN clinic_schema.clinic_services service ON service.id=eligibility.service_id
          WHERE eligibility.clinic_location_id=$1::uuid
          ORDER BY eligibility.active DESC, doctor.full_name, service.display_name, eligibility.id
        `, [input.locationId]);
      const doctors = await client.query(`
          SELECT staff.id AS staff_id, staff.catalog_doctor_id AS doctor_id,
                 staff.display_name, doctor.full_name
          FROM clinic_schema.clinic_staff staff
          JOIN catalog_schema.doctors doctor ON doctor.id=staff.catalog_doctor_id
          WHERE staff.clinic_location_id=$1::uuid AND staff.active AND staff.role='VETERINARIAN'
          ORDER BY doctor.full_name, doctor.id
        `, [input.locationId]);
      const veterinarians = await client.query(`SELECT id,display_name,catalog_doctor_id FROM clinic_schema.clinic_staff WHERE clinic_location_id=$1::uuid AND active AND role='VETERINARIAN' ORDER BY display_name,id`, [input.locationId]);
      const catalogDoctors = await client.query(`SELECT id,full_name FROM catalog_schema.doctors WHERE clinic_location_id=$1::uuid AND active ORDER BY full_name,id`, [input.locationId]);
      const runs = await client.query(`
          SELECT run.id, run.doctor_shift_id, run.shift_version, run.generation_version,
                 run.status, run.slot_count, run.completed_at
          FROM clinic_schema.inventory_generation_runs run
          JOIN clinic_schema.doctor_shifts shift ON shift.id=run.doctor_shift_id
          WHERE shift.clinic_id=$1::uuid AND shift.clinic_location_id=$2::uuid
          ORDER BY run.created_at DESC, run.id DESC
          LIMIT 1000
        `, [input.clinicId, input.locationId]);
      const generatedSlots=await client.query(`
        SELECT slot.id,slot.doctor_shift_id,slot.generation_run_id,slot.service_id,
               service.display_name AS service_name,slot.starts_at,slot.ends_at,slot.capacity,
               slot.held_count,slot.booked_count,slot.state,slot.status,slot.publication_state,slot.version
        FROM clinic_schema.appointment_slots slot
        JOIN clinic_schema.doctor_shifts shift ON shift.id=slot.doctor_shift_id
        JOIN clinic_schema.clinic_services service ON service.id=slot.service_id
        WHERE shift.clinic_id=$1::uuid AND shift.clinic_location_id=$2::uuid
          AND slot.starts_at<$4::timestamptz AND slot.ends_at>$3::timestamptz
        ORDER BY slot.starts_at,slot.service_id,slot.id
        LIMIT 5000
      `,[input.clinicId,input.locationId,input.from,input.to]);
      return { clinicId: input.clinicId, locationId: input.locationId, timezone: location.rows[0]?.timezone, mutationEnabled: featureFlags.DOCTOR_SHIFT_INVENTORY_V1, shifts: shifts.rows.map(this.shift), doctorServices: services.rows, doctors: doctors.rows, veterinarians: veterinarians.rows, catalogDoctors: catalogDoctors.rows, runs: runs.rows, generatedSlots: generatedSlots.rows };
    });
  }

  async mapDoctor(input: { clinicId: string; locationId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; staffId: string; doctorId: string }) {
    return this.command(input, 'doctor-mapping.create', async (client) => {
      await this.assertDoctorContext(client,input.clinicId,input.locationId,input.staffId,input.doctorId,false);
      await this.doctorLock(client, input.doctorId);
      const current=await client.query<{catalog_doctor_id:string|null}>(`SELECT catalog_doctor_id::text FROM clinic_schema.clinic_staff WHERE id=$1::uuid AND clinic_location_id=$2::uuid AND active AND role='VETERINARIAN' FOR UPDATE`,[input.staffId,input.locationId]);
      if(!current.rows[0]) throw new NotFoundException({code:'DOCTOR_MAPPING_CONTEXT_NOT_FOUND'});
      if(current.rows[0].catalog_doctor_id && current.rows[0].catalog_doctor_id!==input.doctorId) throw new ConflictException({code:'DOCTOR_MAPPING_EXISTS'});
      const mapped=await client.query(`UPDATE clinic_schema.clinic_staff staff SET catalog_doctor_id=$3::uuid,version=version+CASE WHEN catalog_doctor_id IS DISTINCT FROM $3::uuid THEN 1 ELSE 0 END,updated_at=clock_timestamp() FROM clinic_schema.clinic_locations location,catalog_schema.doctors doctor WHERE staff.id=$1::uuid AND staff.clinic_location_id=$2::uuid AND location.id=staff.clinic_location_id AND location.clinic_id=$4::uuid AND doctor.id=$3::uuid AND doctor.clinic_location_id=location.id AND doctor.active RETURNING staff.id AS staff_id,staff.catalog_doctor_id AS doctor_id,staff.version`,[input.staffId,input.locationId,input.doctorId,input.clinicId]);
      if(!mapped.rows[0]) throw new NotFoundException({code:'DOCTOR_MAPPING_CONTEXT_NOT_FOUND'});
      await this.fact(client,'doctor_mapping.created','clinic_staff',input.staffId,mapped.rows[0].version,input,mapped.rows[0]);
      return mapped.rows[0];
    });
  }

  async createDoctorService(input: {
    clinicId: string; locationId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string;
    staffId: string; doctorId: string; serviceId: string; resourceId: string | null;
  }) {
    return this.command(input, 'doctor-service.create', async (client) => {
      await this.assertDoctorContext(client,input.clinicId,input.locationId,input.staffId,input.doctorId,true);
      await this.doctorLock(client, input.doctorId);
      const result = await client.query(`
        INSERT INTO clinic_schema.doctor_services
          (clinic_location_id, staff_id, doctor_id, service_id, resource_id, slot_capacity, created_by)
        SELECT location.id, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 1, $7::uuid
        FROM clinic_schema.clinic_locations location
        JOIN clinic_schema.clinic_staff staff ON true
        JOIN clinic_schema.clinic_services service ON service.id=$5::uuid AND service.clinic_location_id=$2::uuid AND service.active
        WHERE location.id=$2::uuid AND location.clinic_id=$1::uuid
          AND staff.id=$3::uuid AND staff.clinic_location_id=$2::uuid AND staff.catalog_doctor_id=$4::uuid
          AND staff.active AND staff.role='VETERINARIAN'
          AND ($6::uuid IS NULL OR EXISTS (
            SELECT 1 FROM clinic_schema.clinic_resources resource
            WHERE resource.id=$6::uuid AND resource.clinic_location_id=$2::uuid AND resource.active))
        RETURNING *
      `, [input.clinicId, input.locationId, input.staffId, input.doctorId, input.serviceId, input.resourceId, input.employee.sub]);
      if (!result.rows[0]) throw new NotFoundException({ code: 'DOCTOR_SERVICE_CONTEXT_NOT_FOUND' });
      await this.fact(client, 'doctor_service.created', 'doctor_service', result.rows[0].id, 1, input, result.rows[0]);
      return result.rows[0];
    });
  }

  async createShift(input: {
    clinicId: string; locationId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string;
    staffId: string; doctorId: string; startsAt: string; endsAt: string;
  }) {
    return this.command(input, 'doctor-shift.create', async (client) => {
      const interval=await this.normalizeInterval(client,input.clinicId,input.locationId,input.startsAt,input.endsAt);
      await this.assertDoctorContext(client,input.clinicId,input.locationId,input.staffId,input.doctorId,true);
      await this.doctorLock(client, input.doctorId);
      const result = await client.query<ShiftRow>(`
        INSERT INTO clinic_schema.doctor_shifts
          (clinic_id, clinic_location_id, staff_id, doctor_id, starts_at, ends_at, timezone, created_by, updated_by)
        SELECT $1::uuid, location.id, staff.id, $4::uuid, $5::timestamptz, $6::timestamptz,
               location.timezone, $7::uuid, $7::uuid
        FROM clinic_schema.clinic_locations location
        JOIN clinic_schema.clinic_staff staff ON staff.id=$3::uuid
          AND staff.clinic_location_id=location.id AND staff.catalog_doctor_id=$4::uuid
          AND staff.active AND staff.role='VETERINARIAN'
        WHERE location.id=$2::uuid AND location.clinic_id=$1::uuid
          AND EXISTS (SELECT 1 FROM pg_timezone_names zone WHERE zone.name=location.timezone)
        RETURNING *
      `, [input.clinicId, input.locationId, input.staffId, input.doctorId, interval.startsAt, interval.endsAt, input.employee.sub]);
      if (!result.rows[0]) throw new NotFoundException({ code: 'DOCTOR_SHIFT_CONTEXT_NOT_FOUND' });
      await this.fact(client, 'doctor_shift.created', 'doctor_shift', result.rows[0].id, 1, input, this.shift(result.rows[0]));
      return this.shift(result.rows[0]);
    });
  }

  async updateShift(input: {
    clinicId: string; locationId: string; shiftId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string;
    expectedVersion: number; startsAt: string; endsAt: string;
  }) {
    return this.command(input, 'doctor-shift.update', async (client) => {
      const current = await this.lockShiftForCommand(client, input);
      await this.assertNoProtectedInventory(client, current.id);
      const interval=await this.normalizeInterval(client,input.clinicId,input.locationId,input.startsAt,input.endsAt);
      if (current.aggregate_version !== input.expectedVersion) throw new ConflictException({ code: 'DOCTOR_SHIFT_VERSION_STALE' });
      if (current.status === 'CANCELLED') throw new ConflictException({ code: 'DOCTOR_SHIFT_CANCELLED' });
      await client.query(`
        UPDATE clinic_schema.appointment_slots
        SET state='CLOSED', publication_state='STALE_SOURCE', source_stale_at=clock_timestamp(), published_at=NULL,
            unpublished_at=NULL, blocked_at=NULL,
            updated_at=clock_timestamp(), version=version+1
        WHERE doctor_shift_id=$1::uuid AND publication_state <> 'STALE_SOURCE'
      `, [input.shiftId]);
      const result = await client.query<ShiftRow>(`
        UPDATE clinic_schema.doctor_shifts
        SET starts_at=$2::timestamptz, ends_at=$3::timestamptz, status='DRAFT',
            aggregate_version=aggregate_version+1, updated_by=$4::uuid, updated_at=clock_timestamp()
        WHERE id=$1::uuid RETURNING *
      `, [input.shiftId, interval.startsAt, interval.endsAt, input.employee.sub]);
      await this.fact(client, 'doctor_shift.updated', 'doctor_shift', input.shiftId, result.rows[0].aggregate_version, input, this.shift(result.rows[0]));
      return this.shift(result.rows[0]);
    });
  }

  async generate(input: {
    clinicId: string; locationId: string; shiftId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string;
    expectedVersion: number;
  }) {
    return this.command(input, 'inventory.generate', async (client) => {
      const shift = await this.lockShiftForCommand(client, input);
      await this.assertNoProtectedInventory(client, shift.id);
      if (shift.aggregate_version !== input.expectedVersion) throw new ConflictException({ code: 'DOCTOR_SHIFT_VERSION_STALE' });
      if (shift.status === 'CANCELLED' || shift.status === 'BLOCKED') throw new ConflictException({ code: 'DOCTOR_SHIFT_NOT_GENERATABLE' });
      const rules = await client.query(`
        SELECT eligibility.id, eligibility.service_id, eligibility.resource_id, eligibility.slot_capacity,
               service.duration_minutes
        FROM clinic_schema.doctor_services eligibility
        JOIN clinic_schema.clinic_services service ON service.id=eligibility.service_id AND service.active
        JOIN clinic_schema.clinic_staff staff ON staff.id=eligibility.staff_id AND staff.active AND staff.role='VETERINARIAN' AND staff.catalog_doctor_id=eligibility.doctor_id
        JOIN catalog_schema.doctors doctor ON doctor.id=eligibility.doctor_id AND doctor.active AND doctor.public_booking_enabled
        WHERE eligibility.clinic_location_id=$1::uuid AND eligibility.staff_id=$2::uuid
          AND eligibility.doctor_id=$3::uuid AND eligibility.active
          AND (eligibility.resource_id IS NULL OR EXISTS (SELECT 1 FROM clinic_schema.clinic_resources resource WHERE resource.id=eligibility.resource_id AND resource.clinic_location_id=$1::uuid AND resource.active))
        ORDER BY eligibility.id
        FOR SHARE OF eligibility, service, staff, doctor
      `, [input.locationId, shift.staff_id, shift.doctor_id]);
      if (!rules.rows.length) throw new ConflictException({ code: 'DOCTOR_SHIFT_NO_ACTIVE_SERVICES' });
      const blackouts = await client.query(`
        SELECT id, period_type, starts_at, ends_at, staff_id, resource_id
        FROM clinic_schema.schedule_periods
        WHERE clinic_location_id=$1::uuid AND active
          AND period_type IN ('BLACKOUT','VACATION')
          AND starts_at < $3::timestamptz AND ends_at > $2::timestamptz
          AND (staff_id IS NULL OR staff_id=$4::uuid)
        ORDER BY starts_at, id
        FOR SHARE
      `, [input.locationId, shift.starts_at, shift.ends_at, shift.staff_id]);
      const snapshot = { shift: { id: shift.id, version: shift.aggregate_version, startsAt: shift.starts_at.toISOString(), endsAt: shift.ends_at.toISOString(), timezone: shift.timezone }, services: rules.rows, blackouts: blackouts.rows };
      const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      const nextVersion = shift.generation_version + 1;
      const run = await client.query(`
        INSERT INTO clinic_schema.inventory_generation_runs
          (doctor_shift_id, shift_version, generation_version, rules_fingerprint, input_snapshot, created_by)
        VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::uuid)
        ON CONFLICT (doctor_shift_id, shift_version, rules_fingerprint)
        DO UPDATE SET attempt_count=CASE WHEN clinic_schema.inventory_generation_runs.status='FAILED'
                                      THEN clinic_schema.inventory_generation_runs.attempt_count+1
                                      ELSE clinic_schema.inventory_generation_runs.attempt_count END,
                      status=CASE WHEN clinic_schema.inventory_generation_runs.status='FAILED' THEN 'GENERATING'
                                  ELSE clinic_schema.inventory_generation_runs.status END,
                      error_code=NULL,
                      completed_at=CASE WHEN clinic_schema.inventory_generation_runs.status='FAILED' THEN NULL
                                        ELSE clinic_schema.inventory_generation_runs.completed_at END
        RETURNING *
      `, [shift.id, shift.aggregate_version, nextVersion, fingerprint, JSON.stringify(snapshot), input.employee.sub]);
      const generation = run.rows[0];
      if (generation.status !== 'GENERATED' && generation.status !== 'PUBLISHED') {
        const inserted = await client.query(`
          INSERT INTO clinic_schema.appointment_slots
            (clinic_location_id, service_id, staff_id, resource_id, doctor_id, starts_at, ends_at,
             capacity, state, source, version, doctor_shift_id, doctor_service_id, generation_run_id,
             generation_version, duration_minutes_snapshot, publication_state)
          SELECT $1::uuid, rule.service_id, $2::uuid, rule.resource_id, $3::uuid,
                 candidate.starts_at, candidate.starts_at + rule.duration_minutes * interval '1 minute',
                 1, 'CLOSED', 'DOCTOR_SHIFT', 1, $4::uuid, rule.id, $5::uuid, $6,
                 rule.duration_minutes, 'DRAFT'
          FROM jsonb_to_recordset($9::jsonb) AS rule(id uuid,service_id uuid,resource_id uuid,slot_capacity integer,duration_minutes integer)
          CROSS JOIN LATERAL generate_series(
            $7::timestamptz,
            $8::timestamptz - rule.duration_minutes * interval '1 minute',
            rule.duration_minutes * interval '1 minute'
          ) candidate(starts_at)
          WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_to_recordset($10::jsonb) AS blackout(id uuid,period_type text,starts_at timestamptz,ends_at timestamptz,staff_id uuid,resource_id uuid)
              WHERE (blackout.staff_id IS NULL OR blackout.staff_id=$2::uuid)
                AND (blackout.resource_id IS NULL OR blackout.resource_id=rule.resource_id)
                AND tstzrange(blackout.starts_at,blackout.ends_at,'[)') &&
                    tstzrange(candidate.starts_at,candidate.starts_at + rule.duration_minutes * interval '1 minute','[)')
            )
          ON CONFLICT (generation_run_id, doctor_service_id, starts_at) WHERE generation_run_id IS NOT NULL DO NOTHING
          RETURNING id
        `, [input.locationId, shift.staff_id, shift.doctor_id, shift.id, generation.id, generation.generation_version, shift.starts_at, shift.ends_at, JSON.stringify(rules.rows), JSON.stringify(blackouts.rows)]);
        await client.query(`UPDATE clinic_schema.inventory_generation_runs SET status='GENERATED', slot_count=$2, completed_at=clock_timestamp() WHERE id=$1::uuid`, [generation.id, inserted.rowCount]);
        await client.query(`UPDATE clinic_schema.doctor_shifts SET generation_version=GREATEST(generation_version,$2), updated_at=clock_timestamp() WHERE id=$1::uuid`, [shift.id, generation.generation_version]);
        generation.status = 'GENERATED'; generation.slot_count = inserted.rowCount;
      }
      const result = { id: generation.id, shiftId: shift.id, shiftVersion: generation.shift_version, generationVersion: generation.generation_version, status: generation.status, slotCount: generation.slot_count, rulesFingerprint: fingerprint };
      await this.fact(client, 'inventory.generated', 'inventory_generation_run', generation.id, generation.generation_version, input, result);
      return result;
    });
  }

  async publish(input: { clinicId: string; locationId: string; runId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string }) {
    return this.setPublication(input, true);
  }

  async unpublish(input: { clinicId: string; locationId: string; runId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string }) {
    return this.setPublication(input, false);
  }

  async block(input: { clinicId: string; locationId: string; shiftId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number }) {
    return this.command(input, 'doctor-shift.block', async (client) => {
      const shift = await this.lockShiftForCommand(client, input);
      await this.assertNoProtectedInventory(client, shift.id);
      if (shift.aggregate_version !== input.expectedVersion) throw new ConflictException({ code: 'DOCTOR_SHIFT_VERSION_STALE' });
      if (!['DRAFT','PUBLISHED'].includes(shift.status)) throw new ConflictException({ code: 'DOCTOR_SHIFT_NOT_BLOCKABLE' });
      const updated = await client.query<ShiftRow>(`UPDATE clinic_schema.doctor_shifts SET status='BLOCKED',aggregate_version=aggregate_version+1,updated_by=$2::uuid,updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING *`, [shift.id, input.employee.sub]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',blocked_at=clock_timestamp(),published_at=NULL,unpublished_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1 WHERE doctor_shift_id=$1::uuid AND publication_state<>'BLOCKED'`, [shift.id]);
      const result = this.shift(updated.rows[0]);
      await this.fact(client, 'doctor_shift.blocked', 'doctor_shift', shift.id, updated.rows[0].aggregate_version, input, result);
      return result;
    });
  }

  async cancel(input: { clinicId: string; locationId: string; shiftId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string; expectedVersion: number }) {
    return this.command(input, 'doctor-shift.cancel', async (client) => {
      const shift = await this.lockShiftForCommand(client, input);
      await this.assertNoProtectedInventory(client, shift.id);
      if (shift.aggregate_version !== input.expectedVersion) throw new ConflictException({ code: 'DOCTOR_SHIFT_VERSION_STALE' });
      if (shift.status === 'CANCELLED') throw new ConflictException({ code: 'DOCTOR_SHIFT_CANCELLED' });
      const updated = await client.query<ShiftRow>(`UPDATE clinic_schema.doctor_shifts SET status='CANCELLED',aggregate_version=aggregate_version+1,updated_by=$2::uuid,updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING *`, [shift.id, input.employee.sub]);
      await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='BLOCKED',blocked_at=clock_timestamp(),published_at=NULL,unpublished_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1 WHERE doctor_shift_id=$1::uuid AND publication_state<>'BLOCKED'`, [shift.id]);
      const result = this.shift(updated.rows[0]);
      await this.fact(client, 'doctor_shift.cancelled', 'doctor_shift', shift.id, updated.rows[0].aggregate_version, input, result);
      return result;
    });
  }

  private async setPublication(input: { clinicId: string; locationId: string; runId: string; employee: JwtPayload; idempotencyKey: string; correlationId: string }, publish: boolean) {
    return this.command(input, publish ? 'inventory.publish' : 'inventory.unpublish', async (client) => {
      const identity = await client.query<{doctor_id:string}>(`
        SELECT shift.doctor_id FROM clinic_schema.inventory_generation_runs run
        JOIN clinic_schema.doctor_shifts shift ON shift.id=run.doctor_shift_id
        WHERE run.id=$1::uuid AND shift.clinic_id=$2::uuid AND shift.clinic_location_id=$3::uuid
      `,[input.runId,input.clinicId,input.locationId]);
      if (!identity.rows[0]) throw new NotFoundException({ code: 'INVENTORY_RUN_NOT_FOUND' });
      await this.doctorLock(client, identity.rows[0].doctor_id);
      const found = await client.query(`
        SELECT run.*, shift.doctor_id, shift.clinic_id, shift.clinic_location_id,
               shift.status AS shift_status,shift.aggregate_version AS current_shift_version
        FROM clinic_schema.inventory_generation_runs run
        JOIN clinic_schema.doctor_shifts shift ON shift.id=run.doctor_shift_id
        WHERE run.id=$1::uuid AND shift.clinic_id=$2::uuid AND shift.clinic_location_id=$3::uuid
        FOR UPDATE OF run, shift
      `, [input.runId, input.clinicId, input.locationId]);
      const run = found.rows[0];
      if (!run) throw new NotFoundException({ code: 'INVENTORY_RUN_NOT_FOUND' });
      if (publish && run.status !== 'GENERATED') throw new ConflictException({ code: 'INVENTORY_RUN_NOT_PUBLISHABLE' });
      if (publish && run.shift_status !== 'DRAFT') throw new ConflictException({ code: 'DOCTOR_SHIFT_NOT_PUBLISHABLE' });
      if (publish && run.shift_version !== run.current_shift_version) throw new ConflictException({code:'INVENTORY_SOURCE_STALE'});
      await this.assertNoProtectedInventory(client, run.doctor_shift_id);
      if (publish) {
        await client.query(`
          UPDATE clinic_schema.appointment_slots slot SET state='CLOSED',publication_state='UNPUBLISHED',unpublished_at=clock_timestamp(),published_at=NULL,blocked_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1
          WHERE slot.doctor_shift_id=$1::uuid AND slot.generation_run_id<>$2::uuid AND slot.publication_state='PUBLISHED'
        `, [run.doctor_shift_id, run.id]);
        await client.query(`UPDATE clinic_schema.inventory_generation_runs SET status='SUPERSEDED' WHERE doctor_shift_id=$1::uuid AND id<>$2::uuid AND status='PUBLISHED'`, [run.doctor_shift_id, run.id]);
        await client.query(`
          UPDATE clinic_schema.appointment_slots candidate
          SET state='CLOSED',publication_state='BLOCKED',blocked_at=clock_timestamp(),published_at=NULL,unpublished_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1
          WHERE candidate.generation_run_id=$1::uuid
            AND EXISTS (
              SELECT 1 FROM booking_schema.booking_holds hold
              JOIN clinic_schema.appointment_slots occupied ON occupied.id=hold.slot_id
              WHERE occupied.doctor_id=candidate.doctor_id AND occupied.id<>candidate.id
                AND tstzrange(occupied.starts_at,occupied.ends_at,'[)') && tstzrange(candidate.starts_at,candidate.ends_at,'[)')
                AND (hold.state IN ('CONFIRMED','CANCELLATION_REQUESTED','RESCHEDULE_REQUESTED')
                  OR (hold.state IN ('MANUAL_CONFIRM_PENDING','ALTERNATIVE_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING','MIS_HELD','PAYMENT_PENDING','PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING') AND hold.expires_at>clock_timestamp()))
            )
        `, [run.id]);
        const slots = await client.query(`UPDATE clinic_schema.appointment_slots SET state='OPEN',publication_state='PUBLISHED',published_at=clock_timestamp(),unpublished_at=NULL,blocked_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1 WHERE generation_run_id=$1::uuid AND publication_state IN ('DRAFT','UNPUBLISHED') RETURNING id`, [run.id]);
        await client.query(`UPDATE clinic_schema.inventory_generation_runs SET status='PUBLISHED' WHERE id=$1::uuid`, [run.id]);
        await client.query(`UPDATE clinic_schema.doctor_shifts SET status='PUBLISHED',updated_at=clock_timestamp() WHERE id=$1::uuid`, [run.doctor_shift_id]);
        const result = { runId: run.id, shiftId: run.doctor_shift_id, publicationState: 'PUBLISHED', slotCount: slots.rowCount };
        await this.fact(client, 'inventory.published', 'inventory_generation_run', run.id, run.generation_version, input, result);
        return result;
      }
      const slots = await client.query(`UPDATE clinic_schema.appointment_slots SET state='CLOSED',publication_state='UNPUBLISHED',unpublished_at=clock_timestamp(),published_at=NULL,blocked_at=NULL,source_stale_at=NULL,updated_at=clock_timestamp(),version=version+1 WHERE generation_run_id=$1::uuid AND publication_state='PUBLISHED' RETURNING id`, [run.id]);
      await client.query(`UPDATE clinic_schema.inventory_generation_runs SET status='GENERATED' WHERE id=$1::uuid AND status='PUBLISHED'`, [run.id]);
      await client.query(`UPDATE clinic_schema.doctor_shifts SET status='DRAFT',updated_at=clock_timestamp() WHERE id=$1::uuid AND status='PUBLISHED' AND EXISTS (SELECT 1 FROM clinic_schema.inventory_generation_runs current WHERE current.id=$2::uuid AND current.status='GENERATED') AND NOT EXISTS (SELECT 1 FROM clinic_schema.inventory_generation_runs other WHERE other.doctor_shift_id=$1::uuid AND other.status='PUBLISHED')`, [run.doctor_shift_id,run.id]);
      const result = { runId: run.id, shiftId: run.doctor_shift_id, publicationState: 'UNPUBLISHED', slotCount: slots.rowCount };
      await this.fact(client, 'inventory.unpublished', 'inventory_generation_run', run.id, run.generation_version, input, result);
      return result;
    });
  }

  private async command<T extends { clinicId: string; locationId: string; employee: JwtPayload; idempotencyKey: string }, R>(input: T, action: string, work: (client: PoolClient) => Promise<R>): Promise<R> {
    if(!featureFlags.DOCTOR_SHIFT_INVENTORY_V1) throw DomainErrors.doctorShiftInventoryDisabled();
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout='2s'; SET LOCAL lock_timeout='750ms'");
      await this.access.assertScheduleManageAccess(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.${action}:${input.employee.sub}`;
      const fingerprint = createHash('sha256').update(JSON.stringify(input, (key, value) => {
        if (key === 'idempotencyKey' || key === 'correlationId') return undefined;
        return key === 'employee' ? input.employee.sub : value;
      })).digest('hex');
      const inserted = await client.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint) VALUES($1,$2::uuid,'PROCESSING',$3) ON CONFLICT DO NOTHING RETURNING id`, [scope, input.idempotencyKey, fingerprint]);
      if (!inserted.rows[0]) {
        const existing = await client.query(`SELECT status,response_body,request_fingerprint FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2::uuid FOR UPDATE`, [scope, input.idempotencyKey]);
        if (existing.rows[0]?.request_fingerprint !== fingerprint) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        if (existing.rows[0]?.status === 'COMPLETED') return existing.rows[0].response_body as R;
        throw new ConflictException({ code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
      }
      const result = await work(client);
      await client.query(`UPDATE booking_schema.idempotency_records SET status='COMPLETED',response_status=$3,response_body=$4::jsonb,updated_at=clock_timestamp() WHERE scope=$1 AND idempotency_key=$2::uuid`, [scope, input.idempotencyKey, HttpStatus.OK, JSON.stringify(result)]);
      return result;
    }).catch((error: unknown) => {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === '23P01') throw new ConflictException({ code: 'DOCTOR_SHIFT_OVERLAP' });
      if (code === '23505') throw new ConflictException({ code: action === 'doctor-service.create' ? 'DOCTOR_SERVICE_EXISTS' : 'SCHEDULE_CONFLICT' });
      if(['55P03','40P01','57014'].includes(code)) throw new ConflictException({code:'DOCTOR_SCHEDULE_RETRY'});
      if(['22007','22008','23514'].includes(code)) throw new ConflictException({code:'DOCTOR_SHIFT_INTERVAL_INVALID'});
      throw error;
    });
  }

  private async lockShift(client: PoolClient, input: { clinicId: string; locationId: string; shiftId: string }): Promise<ShiftRow> {
    const result = await client.query<ShiftRow>(`SELECT * FROM clinic_schema.doctor_shifts WHERE id=$1::uuid AND clinic_id=$2::uuid AND clinic_location_id=$3::uuid FOR UPDATE`, [input.shiftId, input.clinicId, input.locationId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'DOCTOR_SHIFT_NOT_FOUND' });
    return result.rows[0];
  }

  private async lockShiftForCommand(client: PoolClient, input: { clinicId: string; locationId: string; shiftId: string }): Promise<ShiftRow> {
    const identity=await client.query<{doctor_id:string}>(`SELECT doctor_id FROM clinic_schema.doctor_shifts WHERE id=$1::uuid AND clinic_id=$2::uuid AND clinic_location_id=$3::uuid`,[input.shiftId,input.clinicId,input.locationId]);
    if(!identity.rows[0]) throw new NotFoundException({code:'DOCTOR_SHIFT_NOT_FOUND'});
    await this.doctorLock(client,identity.rows[0].doctor_id);
    return this.lockShift(client,input);
  }

  private async doctorLock(client: PoolClient, doctorId: string) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [doctorId]);
  }

  private async assertDoctorContext(client:PoolClient,clinicId:string,locationId:string,staffId:string,doctorId:string,requireMapping:boolean):Promise<void>{
    const context=await client.query(`
      SELECT 1 FROM clinic_schema.clinic_locations location
      JOIN clinic_schema.clinic_staff staff ON staff.id=$3::uuid AND staff.clinic_location_id=location.id
        AND staff.active AND staff.role='VETERINARIAN'
      JOIN catalog_schema.doctors doctor ON doctor.id=$4::uuid AND doctor.clinic_location_id=location.id AND doctor.active
      WHERE location.id=$2::uuid AND location.clinic_id=$1::uuid
        AND ($5::boolean=false OR staff.catalog_doctor_id=doctor.id)
    `,[clinicId,locationId,staffId,doctorId,requireMapping]);
    if(!context.rows[0]) throw new NotFoundException({code:'DOCTOR_CONTEXT_NOT_FOUND'});
  }

  private async assertNoProtectedInventory(client:PoolClient,shiftId:string):Promise<void>{
    const protectedRows=await client.query(`SELECT slot.id FROM clinic_schema.appointment_slots slot JOIN booking_schema.booking_holds hold ON hold.slot_id=slot.id OR hold.alternative_slot_id=slot.id WHERE slot.doctor_shift_id=$1::uuid AND (hold.state IN ('CONFIRMED','CANCELLATION_REQUESTED','RESCHEDULE_REQUESTED') OR (hold.state IN ('MANUAL_CONFIRM_PENDING','ALTERNATIVE_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING','MIS_HELD','PAYMENT_PENDING','PAYMENT_IN_PROGRESS','PAYMENT_RECONCILIATION_PENDING') AND hold.expires_at>clock_timestamp())) LIMIT 1 FOR UPDATE OF slot,hold`,[shiftId]);
    if(protectedRows.rows[0]) throw new ConflictException({code:'DOCTOR_SHIFT_HAS_ACTIVE_BOOKINGS'});
  }

  private async normalizeInterval(client:PoolClient,clinicId:string,locationId:string,startsAt:string,endsAt:string):Promise<{startsAt:string;endsAt:string}>{
    const normalized={startsAt:await this.normalizeInstant(client,clinicId,locationId,startsAt),endsAt:await this.normalizeInstant(client,clinicId,locationId,endsAt)};
    const duration=new Date(normalized.endsAt).getTime()-new Date(normalized.startsAt).getTime();
    if(duration<=0||duration>24*60*60*1000) throw new ConflictException({code:'DOCTOR_SHIFT_INTERVAL_INVALID'});
    return normalized;
  }

  private async normalizeInstant(client:PoolClient,clinicId:string,locationId:string,value:string):Promise<string>{
    if(/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)){
      const parsed=new Date(value); if(Number.isNaN(parsed.getTime())) throw new ConflictException({code:'DOCTOR_SHIFT_LOCAL_TIME_INVALID'}); return parsed.toISOString();
    }
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new ConflictException({code:'DOCTOR_SHIFT_LOCAL_TIME_INVALID'});
    const matches=await client.query<{instant:Date}>(`
      SELECT candidate.instant
      FROM clinic_schema.clinic_locations location
      CROSS JOIN LATERAL generate_series(
        ($3::timestamp AT TIME ZONE location.timezone)-interval '2 hours',
        ($3::timestamp AT TIME ZONE location.timezone)+interval '2 hours',interval '1 minute'
      ) candidate(instant)
      WHERE location.id=$1::uuid AND location.clinic_id=$2::uuid
        AND candidate.instant AT TIME ZONE location.timezone=$3::timestamp
    `,[locationId,clinicId,value]);
    if(matches.rows.length!==1) throw new ConflictException({code:matches.rows.length===0?'DOCTOR_SHIFT_LOCAL_TIME_INVALID':'DOCTOR_SHIFT_LOCAL_TIME_AMBIGUOUS'});
    return matches.rows[0].instant.toISOString();
  }

  private async fact(client: PoolClient, event: string, aggregateType: string, aggregateId: string, version: number, input: { employee: JwtPayload; correlationId: string }, payload: unknown) {
    await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('CLINIC_EMPLOYEE',$1,$2,$3,$4::uuid,$5::uuid,$6::jsonb)`, [input.employee.sub, event, aggregateType, aggregateId, input.correlationId, JSON.stringify(payload)]);
    await client.query(`INSERT INTO booking_schema.outbox_events(event_type,producer,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,'doctor-shift-inventory',$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7) ON CONFLICT(deduplication_key) DO NOTHING`, [event, input.correlationId, aggregateType, aggregateId, version, JSON.stringify(payload), `${event}:${aggregateId}:${version}`]);
  }

  private shift(row: ShiftRow) {
    return { id: row.id, clinicId: row.clinic_id, locationId: row.clinic_location_id, staffId: row.staff_id, doctorId: row.doctor_id, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), timezone: row.timezone, status: row.status, version: row.aggregate_version, generationVersion: row.generation_version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
  }
}
