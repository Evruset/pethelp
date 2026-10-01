import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors, DomainException } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

interface AppointmentRow {
  id: string; hold_id: string; owner_id: string; clinic_location_id: string; slot_id: string;
  status: string; lifecycle_state: string | null; version: number; starts_at: Date;
}

@Injectable()
export class AppointmentLifecycleService {
  constructor(private readonly database: DatabaseService, private readonly access: ClinicEmployeeAccessService) {}

  async cancelByClinic(input: { appointmentId: string; clinicId: string; locationId: string; employee: JwtPayload; expectedVersion: number; idempotencyKey: string; correlationId: string; reasonCode?: string; reasonText?: string }) {
    const reasonCode = input.reasonCode?.trim() || null;
    const reasonText = input.reasonText?.trim() || null;
    if (!reasonCode && !reasonText) throw new DomainException(400, 'VALIDATION_ERROR', 'Cancellation reason is required');
    return this.command(input, 'cancel', async (client, appointment) => {
      if (!['CONFIRMED', 'RESCHEDULE_PROPOSED'].includes(appointment.lifecycle_state ?? '')) throw DomainErrors.bookingStateConflict();
      const slots = await this.lockSlots(client, await this.slotIdsForAppointment(client, appointment));
      const proposal = await this.lockPendingProposal(client, appointment.id);
      if (proposal) {
        await this.releaseHeld(client, proposal.alternative_slot_id, slots);
        await client.query("UPDATE booking_schema.alternative_swap_groups SET state='DECLINED',aggregate_version=aggregate_version+1,updated_at=clock_timestamp() WHERE id=$1", [proposal.id]);
      }
      await this.releaseBooked(client, appointment.slot_id, slots);
      const updated = (await client.query<{ version: number; cancelled_at: Date }>(`
        UPDATE booking_schema.appointments SET status='CLINIC_CANCELLED',lifecycle_state='CANCELLED_BY_CLINIC',
          cancelled_by='CLINIC',cancelled_by_actor_id=$2::uuid,cancelled_at=clock_timestamp(),
          cancellation_reason_code=$3,cancellation_reason_text=$4,version=version+1,updated_at=clock_timestamp()
        WHERE id=$1::uuid RETURNING version,cancelled_at
      `, [appointment.id, input.employee.sub, reasonCode, reasonText])).rows[0];
      await client.query("UPDATE booking_schema.booking_holds SET state='RELEASED',state_changed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1", [appointment.hold_id]);
      return { appointmentId: appointment.id, lifecycle: 'CANCELLED_BY_CLINIC', aggregateVersion: updated.version, cancelledAt: updated.cancelled_at.toISOString(), reasonCode, reasonText };
    });
  }

  async propose(input: { appointmentId: string; targetSlotId: string; clinicId: string; locationId: string; employee: JwtPayload; expectedVersion: number; expectedTargetSlotVersion: number; idempotencyKey: string; correlationId: string }) {
    return this.command(input, 'propose', async (client, appointment) => {
      if (appointment.lifecycle_state !== 'CONFIRMED') throw DomainErrors.bookingStateConflict();
      const slots = await this.lockSlots(client, [appointment.slot_id, input.targetSlotId]);
      const source = slots.get(appointment.slot_id), target = slots.get(input.targetSlotId);
      const now = (await client.query<{ now: Date }>('SELECT clock_timestamp() now')).rows[0].now;
      if (!source || !target || target.version !== input.expectedTargetSlotVersion) throw DomainErrors.bookingStateConflict();
      if (source.clinic_location_id !== target.clinic_location_id || source.service_id !== target.service_id) throw DomainErrors.alternativeSlotIncompatible();
      if (target.state !== 'OPEN' || target.status === 'CANCELLED' || target.starts_at <= now || target.booked_count + target.held_count >= target.capacity) throw DomainErrors.alternativeSlotUnavailable();
      await client.query(`UPDATE clinic_schema.appointment_slots SET held_count=held_count+1,status='LOCKED_BY_HOLD',version=version+1,updated_at=clock_timestamp() WHERE id=$1`, [target.id]);
      const proposal = (await client.query<{ id: string; expires_at: Date }>(`
        INSERT INTO booking_schema.alternative_swap_groups(original_hold_id,original_slot_id,alternative_slot_id,owner_id,expires_at,state,correlation_id,appointment_id)
        VALUES($1,$2,$3,$4,clock_timestamp()+interval '24 hours','PENDING',$5,$6) RETURNING id,expires_at
      `, [appointment.hold_id, appointment.slot_id, target.id, appointment.owner_id, input.correlationId, appointment.id])).rows[0];
      const updated = (await client.query<{ version: number }>("UPDATE booking_schema.appointments SET lifecycle_state='RESCHEDULE_PROPOSED',version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING version", [appointment.id])).rows[0];
      return { appointmentId: appointment.id, proposalId: proposal.id, lifecycle: 'RESCHEDULE_PROPOSED', originalSlotId: appointment.slot_id, targetSlotId: target.id, expiresAt: proposal.expires_at, aggregateVersion: updated.version };
    });
  }

  async markNoShow(input: { appointmentId: string; clinicId: string; locationId: string; employee: JwtPayload; expectedVersion: number; idempotencyKey: string; correlationId: string }) {
    return this.command(input, 'no-show', async (client, appointment) => {
      if (appointment.lifecycle_state !== 'CONFIRMED') throw DomainErrors.bookingStateConflict();
      const now = (await client.query<{ now: Date }>('SELECT clock_timestamp() now')).rows[0].now;
      if (appointment.starts_at > now) throw DomainErrors.invalidTransition();
      const updated = (await client.query<{ version: number; no_show_at: Date }>(`
        UPDATE booking_schema.appointments SET status='NO_SHOW',lifecycle_state='NO_SHOW',no_show_at=clock_timestamp(),
          no_show_by_actor_id=$2::uuid,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING version,no_show_at
      `, [appointment.id, input.employee.sub])).rows[0];
      return { appointmentId: appointment.id, lifecycle: 'NO_SHOW', aggregateVersion: updated.version, noShowAt: updated.no_show_at.toISOString() };
    });
  }

  private async command(input: { appointmentId: string; clinicId: string; locationId: string; employee: JwtPayload; expectedVersion: number; idempotencyKey: string; correlationId: string }, action: string, mutate: (client: PoolClient, appointment: AppointmentRow) => Promise<Record<string, unknown>>) {
    try {
      return await this.database.withTransaction(async (client) => {
        await client.query("SET LOCAL lock_timeout='500ms'; SET LOCAL statement_timeout='2500ms'");
        const appointment = await this.lockAppointment(client, input.appointmentId);
        if (!appointment || appointment.clinic_location_id !== input.locationId) throw DomainErrors.clinicScopeMismatch();
        await this.access.assertExactClinicLocationMembership(client, input.employee, input.clinicId, input.locationId);
        const scope = `appointment.${action}:${input.employee.sub}:${appointment.id}`;
        const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, employee: undefined, correlationId: undefined, idempotencyKey: undefined })).digest('hex');
        const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey, fingerprint);
        if (replay) return replay;
        if (appointment.version !== input.expectedVersion) throw DomainErrors.bookingStateConflict();
        const result = await mutate(client, appointment);
        const version = Number(result.aggregateVersion);
        await client.query(`INSERT INTO booking_schema.appointment_events(appointment_id,hold_id,event_type,actor_type,actor_id,correlation_id,payload_json) VALUES($1,$2,$3,'CLINIC_EMPLOYEE',$4,$5,$6::jsonb)`, [appointment.id, appointment.hold_id, `APPOINTMENT_${action.toUpperCase().replace('-', '_')}`, input.employee.sub, input.correlationId, JSON.stringify(result)]);
        await client.query(`INSERT INTO booking_schema.outbox_events(event_type,correlation_id,aggregate_type,aggregate_id,aggregate_version,payload_json,deduplication_key) VALUES($1,$2,'appointment',$3,$4,$5::jsonb,$6)`, [`appointment.${action}.v1`, input.correlationId, appointment.id, version, JSON.stringify(result), `appointment.${action}.v1:${appointment.id}:${version}`]);
        await client.query(`INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,correlation_id,payload_json) VALUES('CLINIC_EMPLOYEE',$1,$2,'appointment',$3,$4,$5::jsonb)`, [input.employee.sub, `appointment.${action}`, appointment.id, input.correlationId, JSON.stringify(result)]);
        await client.query("UPDATE booking_schema.idempotency_records SET status='COMPLETED',response_status=$3,response_body=$4::jsonb,updated_at=clock_timestamp() WHERE scope=$1 AND idempotency_key=$2", [scope, input.idempotencyKey, HttpStatus.OK, JSON.stringify(result)]);
        return result;
      });
    } catch (error) {
      if (error instanceof DomainException) throw error;
      if (['55P03','57014','40P01'].includes(String((error as any)?.code))) throw DomainErrors.slotLockedRetry();
      throw error;
    }
  }

  private async lockAppointment(client: PoolClient, id: string) {
    return (await client.query<AppointmentRow>(`SELECT a.id,a.hold_id,a.owner_id,a.clinic_location_id,a.slot_id,a.status,a.lifecycle_state,a.version,s.starts_at FROM booking_schema.appointments a JOIN booking_schema.booking_holds h ON h.id=a.hold_id JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id WHERE a.id=$1 FOR UPDATE OF h,a`, [id])).rows[0];
  }
  private async lockSlots(client: PoolClient, ids: string[]) { const r=await client.query<any>(`SELECT id,clinic_location_id,service_id,starts_at,capacity,booked_count,held_count,state,status,version FROM clinic_schema.appointment_slots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[...new Set(ids)].sort()]); return new Map<string,any>(r.rows.map((x:any)=>[x.id,x])); }
  private async lockPendingProposal(client: PoolClient, appointmentId: string) { return (await client.query<any>("SELECT * FROM booking_schema.alternative_swap_groups WHERE appointment_id=$1 AND state='PENDING' FOR UPDATE", [appointmentId])).rows[0]; }
  private async slotIdsForAppointment(client: PoolClient, a: AppointmentRow) { const p=(await client.query<any>("SELECT alternative_slot_id FROM booking_schema.alternative_swap_groups WHERE appointment_id=$1 AND state='PENDING'",[a.id])).rows[0]; return p?[a.slot_id,p.alternative_slot_id]:[a.slot_id]; }
  private async releaseBooked(client: PoolClient,id:string,slots:Map<string,any>){const s=slots.get(id);if(!s||s.booked_count<1)throw DomainErrors.bookingStateConflict();await client.query("UPDATE clinic_schema.appointment_slots SET booked_count=booked_count-1,status=CASE WHEN booked_count-1>=capacity THEN 'BOOKED' WHEN held_count>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1",[id]);}
  private async releaseHeld(client: PoolClient,id:string,slots:Map<string,any>){const s=slots.get(id);if(!s||s.held_count<1)throw DomainErrors.bookingStateConflict();await client.query("UPDATE clinic_schema.appointment_slots SET held_count=held_count-1,status=CASE WHEN booked_count>=capacity THEN 'BOOKED' WHEN held_count-1>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,version=version+1,updated_at=clock_timestamp() WHERE id=$1",[id]);}
  private async acquireIdempotency(client:PoolClient,scope:string,key:string,fingerprint:string){const inserted=await client.query(`INSERT INTO booking_schema.idempotency_records(scope,idempotency_key,status,request_fingerprint) VALUES($1,$2,'PROCESSING',$3) ON CONFLICT DO NOTHING RETURNING id`,[scope,key,fingerprint]);if(inserted.rows[0])return null;const row=(await client.query<any>('SELECT status,response_body,request_fingerprint FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2 FOR UPDATE',[scope,key])).rows[0];if(row?.request_fingerprint!==fingerprint)throw DomainErrors.idempotencyConflict();if(row.status==='COMPLETED')return row.response_body;throw DomainErrors.idempotencyInProgress();}
}
