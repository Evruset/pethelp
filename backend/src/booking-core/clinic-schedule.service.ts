import { HttpStatus, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { featureFlags } from '../config/feature-flags.config';
import { DatabaseService } from '../database/database.service';
import { TraceContext } from '../observability/trace-context.context';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

interface ScheduleSlotRow {
  id: string;
  service_id: string | null;
  service_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  resource_id: string | null;
  resource_name: string | null;
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  booked_count: number;
  held_count: number;
  state: string;
  status: string | null;
  source: string;
  integration_mode: string | null;
  last_freshness_sync: Date | null;
  version: number;
  booking_hold_id?: string | null;
  booking_hold_state?: string | null;
  booking_hold_owner_id?: string | null;
  booking_hold_pet_id?: string | null;
}

interface ScheduleStaffRow {
  id: string;
  code: string;
  display_name: string;
  role: string;
  active: boolean;
  source: string;
  external_staff_id: string | null;
  version: number;
  updated_at: Date;
}

interface ScheduleResourceRow {
  id: string;
  code: string;
  display_name: string;
  resource_type: string;
  active: boolean;
  source: string;
  external_resource_id: string | null;
  version: number;
  updated_at: Date;
}

interface SchedulePeriodRow {
  id: string;
  period_type: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY';
  starts_at: Date;
  ends_at: Date;
  staff_id: string | null;
  staff_name: string | null;
  resource_id: string | null;
  resource_name: string | null;
  reason: string | null;
  active: boolean;
  source: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface IdempotencyRow {
  status: 'PROCESSING' | 'COMPLETED';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
}

interface ScheduleServiceRow {
  id: string;
  code: string;
  display_name: string;
  duration_minutes: number;
  active: boolean;
  price_amount: string;
  currency: string;
  version: number;
  updated_at: Date;
}

interface WorkingHoursRow {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  active: boolean;
  source: string;
  updated_at: Date;
}

export interface ClinicWorkingHoursDay {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  active: boolean;
  source: string;
  updatedAt: string | null;
}

export interface ClinicScheduleSlot {
  id: string;
  service: { id: string; displayName: string } | null;
  staff: { id: string; displayName: string } | null;
  resource: { id: string; displayName: string } | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  heldCount: number;
  state: string;
  status: string;
  source: string;
  integrationMode: string;
  lastFreshnessSync: string | null;
  stale: boolean;
  version: number;
  bookingHold: {
    id: string;
    state: string;
    ownerId: string;
    petId: string;
  } | null;
}

export interface ClinicScheduleStaffItem {
  id: string;
  code: string;
  displayName: string;
  role: string;
  active: boolean;
  source: string;
  externalStaffId: string | null;
  version: number;
  updatedAt: string;
}

export interface ClinicScheduleResourceItem {
  id: string;
  code: string;
  displayName: string;
  resourceType: string;
  active: boolean;
  source: string;
  externalResourceId: string | null;
  version: number;
  updatedAt: string;
}

export interface ClinicScheduleServiceItem {
  id: string;
  code: string;
  displayName: string;
  durationMinutes: number;
  active: boolean;
  priceAmount: string;
  currency: string;
  version: number;
  updatedAt: string;
}

export interface ClinicSchedulePeriodItem {
  id: string;
  periodType: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY';
  startsAt: string;
  endsAt: string;
  staff: { id: string; displayName: string } | null;
  resource: { id: string; displayName: string } | null;
  reason: string | null;
  active: boolean;
  source: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicScheduleImportResult {
  imported: number;
  slots: ClinicScheduleSlot[];
}

export interface ClinicScheduleResult {
  clinicId: string;
  locationId: string;
  serverNow: string;
  services: ClinicScheduleServiceItem[];
  staff: ClinicScheduleStaffItem[];
  resources: ClinicScheduleResourceItem[];
  periods: ClinicSchedulePeriodItem[];
  workingHours: ClinicWorkingHoursDay[];
  slots: ClinicScheduleSlot[];
}

export interface ClinicScheduleExportAttemptResult {
  accepted: true;
  serverNow: string;
}

@Injectable()
export class ClinicScheduleService {
  private readonly traceContext = new TraceContext();

  constructor(
    private readonly database: DatabaseService,
    private readonly clinicAccess: ClinicEmployeeAccessService,
  ) {}

  async listSlots(input: { clinicId: string; locationId: string; employee: JwtPayload; from: string; to: string }): Promise<ClinicScheduleResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await this.assertScheduleSlotsReadAccess(client, input.employee, input.clinicId, input.locationId);
      const serverNow = await this.dbNow(client);
      const result = await client.query<ScheduleSlotRow>(`
        SELECT s.id, s.service_id, service.display_name AS service_name,
               s.staff_id, staff.display_name AS staff_name,
               s.resource_id, resource.display_name AS resource_name,
               s.starts_at, s.ends_at, s.capacity, s.booked_count, s.held_count,
               s.state, s.status, s.source, s.integration_mode, s.last_freshness_sync, s.version,
               hold.id::text AS booking_hold_id,
               hold.state AS booking_hold_state,
               hold.owner_id::text AS booking_hold_owner_id,
               hold.pet_id::text AS booking_hold_pet_id
        FROM clinic_schema.appointment_slots s
        LEFT JOIN clinic_schema.clinic_services service ON service.id = s.service_id
        LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = s.staff_id
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = s.resource_id
        LEFT JOIN LATERAL (
          SELECT h.id, h.state, h.owner_id, h.pet_id
          FROM booking_schema.booking_holds h
          WHERE h.slot_id = s.id
            AND h.state IN ('CONFIRMED', 'CANCELLATION_REQUESTED', 'RESCHEDULE_REQUESTED')
          ORDER BY h.created_at DESC, h.id DESC
          LIMIT 1
        ) hold ON true
        WHERE s.clinic_location_id = $1::uuid
          AND s.starts_at >= $2::timestamptz
          AND s.starts_at < $3::timestamptz
        ORDER BY s.starts_at ASC, s.id ASC
      `, [input.locationId, input.from, input.to]);
      const services = await client.query<ScheduleServiceRow>(`
        SELECT id, code, display_name, duration_minutes, active, price_amount::text AS price_amount,
               currency, version, updated_at
        FROM clinic_schema.clinic_services
        WHERE clinic_location_id = $1::uuid
        ORDER BY active DESC, display_name ASC, id ASC
      `, [input.locationId]);
      const staff = await client.query<ScheduleStaffRow>(`
        SELECT id, code, display_name, role, active, source, external_staff_id, version, updated_at
        FROM clinic_schema.clinic_staff
        WHERE clinic_location_id = $1::uuid
        ORDER BY active DESC, display_name ASC, id ASC
      `, [input.locationId]);
      const resources = await client.query<ScheduleResourceRow>(`
        SELECT id, code, display_name, resource_type, active, source, external_resource_id, version, updated_at
        FROM clinic_schema.clinic_resources
        WHERE clinic_location_id = $1::uuid
        ORDER BY active DESC, display_name ASC, id ASC
      `, [input.locationId]);
      const periods = await client.query<SchedulePeriodRow>(`
        SELECT period.id, period.period_type, period.starts_at, period.ends_at,
               period.staff_id, staff.display_name AS staff_name,
               period.resource_id, resource.display_name AS resource_name,
               period.reason, period.active, period.source, period.version,
               period.created_at, period.updated_at
        FROM clinic_schema.schedule_periods period
        LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = period.staff_id
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = period.resource_id
        WHERE period.clinic_location_id = $1::uuid
          AND period.starts_at < $3::timestamptz
          AND period.ends_at > $2::timestamptz
        ORDER BY period.active DESC, period.starts_at ASC, period.id ASC
      `, [input.locationId, input.from, input.to]);
      return {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serverNow: serverNow.toISOString(),
        services: services.rows.map((row) => this.toService(row)),
        staff: staff.rows.map((row) => this.toStaff(row)),
        resources: resources.rows.map((row) => this.toResource(row)),
        periods: periods.rows.map((row) => this.toPeriod(row)),
        workingHours: await this.readWorkingHours(client, input.locationId),
        slots: result.rows.map((row) => this.toSlot(row, serverNow)),
      };
    });
  }

  async updateWorkingHours(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    days: Array<{ weekday: number; opensAt: string | null; closesAt: string | null; active: boolean }>;
  }): Promise<ClinicWorkingHoursDay[]> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.update-working-hours:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicWorkingHoursDay[];

      const normalized = this.normalizeWorkingHours(input.days);
      for (const day of normalized) {
        await client.query(`
          INSERT INTO clinic_schema.location_working_hours (
            clinic_location_id, weekday, opens_at, closes_at, active, source, updated_by
          )
          VALUES ($1::uuid, $2, $3::time, $4::time, $5, 'MANUAL', $6::uuid)
          ON CONFLICT (clinic_location_id, weekday)
          DO UPDATE SET
            opens_at = EXCLUDED.opens_at,
            closes_at = EXCLUDED.closes_at,
            active = EXCLUDED.active,
            source = 'MANUAL',
            updated_by = EXCLUDED.updated_by,
            updated_at = clock_timestamp()
        `, [input.locationId, day.weekday, day.opensAt, day.closesAt, day.active, input.employee.sub]);
      }

      const result = await this.readWorkingHours(client, input.locationId);
      await this.writeOutbox(client, 'clinic.schedule.working_hours.updated.v1', input.correlationId, input.locationId, 1, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        employeeId: input.employee.sub,
        workingHours: result,
      }, 'clinic_location');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.working_hours.updated', input.locationId, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        workingHours: result,
      }, 'clinic_location');
      await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.OK);
      return result;
    });
  }

  async createService(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    code: string;
    displayName: string;
    durationMinutes: number;
    priceAmount: string;
    currency: string;
    active: boolean;
  }): Promise<ClinicScheduleServiceItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.create-service:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleServiceItem;

      const existing = await client.query<{ id: string }>(`
        SELECT id
        FROM clinic_schema.clinic_services
        WHERE clinic_location_id = $1::uuid
          AND code = $2
        FOR SHARE
      `, [input.locationId, input.code]);
      if (existing.rows[0]) throw DomainErrors.serviceCodeExists();

      const inserted = await client.query<ScheduleServiceRow>(`
        INSERT INTO clinic_schema.clinic_services (
          clinic_location_id, code, display_name, duration_minutes, active, price_amount, currency
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6::numeric, $7)
        RETURNING id, code, display_name, duration_minutes, active, price_amount::text AS price_amount,
                  currency, version, updated_at
      `, [input.locationId, input.code, input.displayName, input.durationMinutes, input.active, input.priceAmount, input.currency]);
      const service = this.toService(inserted.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.service.created.v1', input.correlationId, service.id, service.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serviceId: service.id,
        code: service.code,
        displayName: service.displayName,
        durationMinutes: service.durationMinutes,
        priceAmount: service.priceAmount,
        currency: service.currency,
        active: service.active,
        employeeId: input.employee.sub,
      }, 'clinic_service');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.service.created', service.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        service,
      }, 'clinic_service');
      await this.completeIdempotency(client, scope, input.idempotencyKey, service, HttpStatus.CREATED);
      return service;
    });
  }

  async updateService(input: {
    clinicId: string;
    locationId: string;
    serviceId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    code: string;
    displayName: string;
    durationMinutes: number;
    priceAmount: string;
    currency: string;
    active: boolean;
  }): Promise<ClinicScheduleServiceItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.update-service:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleServiceItem;

      const current = await client.query<ScheduleServiceRow>(`
        SELECT id, code, display_name, duration_minutes, active, price_amount::text AS price_amount,
               currency, version, updated_at
        FROM clinic_schema.clinic_services
        WHERE id = $1::uuid
          AND clinic_location_id = $2::uuid
        FOR UPDATE
      `, [input.serviceId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.serviceNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.serviceVersionStale();

      if (row.code !== input.code) {
        const duplicate = await client.query<{ id: string }>(`
          SELECT id
          FROM clinic_schema.clinic_services
          WHERE clinic_location_id = $1::uuid
            AND code = $2
            AND id <> $3::uuid
          FOR SHARE
        `, [input.locationId, input.code, input.serviceId]);
        if (duplicate.rows[0]) throw DomainErrors.serviceCodeExists();
      }

      if (row.active && !input.active) {
        await this.assertNoFutureActiveBookingsForService(client, input.serviceId);
      }

      const updated = await client.query<ScheduleServiceRow>(`
        UPDATE clinic_schema.clinic_services
        SET code = $2,
            display_name = $3,
            duration_minutes = $4,
            active = $5,
            price_amount = $6::numeric,
            currency = $7,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, code, display_name, duration_minutes, active, price_amount::text AS price_amount,
                  currency, version, updated_at
      `, [input.serviceId, input.code, input.displayName, input.durationMinutes, input.active, input.priceAmount, input.currency]);
      const service = this.toService(updated.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.service.updated.v1', input.correlationId, service.id, service.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serviceId: service.id,
        previous: this.toService(row),
        service,
        employeeId: input.employee.sub,
      }, 'clinic_service');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.service.updated', service.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previous: this.toService(row),
        service,
      }, 'clinic_service');
      await this.completeIdempotency(client, scope, input.idempotencyKey, service, HttpStatus.OK);
      return service;
    });
  }

  async createStaff(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    code: string;
    displayName: string;
    role: string;
    active: boolean;
  }): Promise<ClinicScheduleStaffItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.create-staff:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleStaffItem;
      const existing = await client.query<{ id: string }>(`
        SELECT id
        FROM clinic_schema.clinic_staff
        WHERE clinic_location_id = $1::uuid AND code = $2
        FOR SHARE
      `, [input.locationId, input.code]);
      if (existing.rows[0]) throw DomainErrors.staffCodeExists();
      const inserted = await client.query<ScheduleStaffRow>(`
        INSERT INTO clinic_schema.clinic_staff (clinic_location_id, code, display_name, role, active, source)
        VALUES ($1::uuid, $2, $3, $4, $5, 'MANUAL')
        RETURNING id, code, display_name, role, active, source, external_staff_id, version, updated_at
      `, [input.locationId, input.code, input.displayName, input.role, input.active]);
      const staff = this.toStaff(inserted.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.staff.created.v1', input.correlationId, staff.id, staff.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        staff,
        employeeId: input.employee.sub,
      }, 'clinic_staff');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.staff.created', staff.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        staff,
      }, 'clinic_staff');
      await this.completeIdempotency(client, scope, input.idempotencyKey, staff, HttpStatus.CREATED);
      return staff;
    });
  }

  async updateStaff(input: {
    clinicId: string;
    locationId: string;
    staffId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    code: string;
    displayName: string;
    role: string;
    active: boolean;
  }): Promise<ClinicScheduleStaffItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.update-staff:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleStaffItem;
      const current = await client.query<ScheduleStaffRow>(`
        SELECT id, code, display_name, role, active, source, external_staff_id, version, updated_at
        FROM clinic_schema.clinic_staff
        WHERE id = $1::uuid AND clinic_location_id = $2::uuid
        FOR UPDATE
      `, [input.staffId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.staffNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.staffVersionStale();
      if (row.code !== input.code) {
        const duplicate = await client.query<{ id: string }>(`
          SELECT id
          FROM clinic_schema.clinic_staff
          WHERE clinic_location_id = $1::uuid AND code = $2 AND id <> $3::uuid
          FOR SHARE
        `, [input.locationId, input.code, input.staffId]);
        if (duplicate.rows[0]) throw DomainErrors.staffCodeExists();
      }
      if (row.active && !input.active) {
        await this.assertNoFutureActiveBookingsForStaff(client, input.staffId);
      }
      const updated = await client.query<ScheduleStaffRow>(`
        UPDATE clinic_schema.clinic_staff
        SET code = $2,
            display_name = $3,
            role = $4,
            active = $5,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, code, display_name, role, active, source, external_staff_id, version, updated_at
      `, [input.staffId, input.code, input.displayName, input.role, input.active]);
      const staff = this.toStaff(updated.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.staff.updated.v1', input.correlationId, staff.id, staff.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previous: this.toStaff(row),
        staff,
        employeeId: input.employee.sub,
      }, 'clinic_staff');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.staff.updated', staff.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previous: this.toStaff(row),
        staff,
      }, 'clinic_staff');
      await this.completeIdempotency(client, scope, input.idempotencyKey, staff, HttpStatus.OK);
      return staff;
    });
  }

  async createResource(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    code: string;
    displayName: string;
    resourceType: string;
    active: boolean;
  }): Promise<ClinicScheduleResourceItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.create-resource:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleResourceItem;
      const existing = await client.query<{ id: string }>(`
        SELECT id
        FROM clinic_schema.clinic_resources
        WHERE clinic_location_id = $1::uuid AND code = $2
        FOR SHARE
      `, [input.locationId, input.code]);
      if (existing.rows[0]) throw DomainErrors.resourceCodeExists();
      const inserted = await client.query<ScheduleResourceRow>(`
        INSERT INTO clinic_schema.clinic_resources (clinic_location_id, code, display_name, resource_type, active, source)
        VALUES ($1::uuid, $2, $3, $4, $5, 'MANUAL')
        RETURNING id, code, display_name, resource_type, active, source, external_resource_id, version, updated_at
      `, [input.locationId, input.code, input.displayName, input.resourceType, input.active]);
      const resource = this.toResource(inserted.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.resource.created.v1', input.correlationId, resource.id, resource.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        resource,
        employeeId: input.employee.sub,
      }, 'clinic_resource');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.resource.created', resource.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        resource,
      }, 'clinic_resource');
      await this.completeIdempotency(client, scope, input.idempotencyKey, resource, HttpStatus.CREATED);
      return resource;
    });
  }

  async updateResource(input: {
    clinicId: string;
    locationId: string;
    resourceId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    code: string;
    displayName: string;
    resourceType: string;
    active: boolean;
  }): Promise<ClinicScheduleResourceItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.update-resource:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleResourceItem;
      const current = await client.query<ScheduleResourceRow>(`
        SELECT id, code, display_name, resource_type, active, source, external_resource_id, version, updated_at
        FROM clinic_schema.clinic_resources
        WHERE id = $1::uuid AND clinic_location_id = $2::uuid
        FOR UPDATE
      `, [input.resourceId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.resourceNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.resourceVersionStale();
      if (row.code !== input.code) {
        const duplicate = await client.query<{ id: string }>(`
          SELECT id
          FROM clinic_schema.clinic_resources
          WHERE clinic_location_id = $1::uuid AND code = $2 AND id <> $3::uuid
          FOR SHARE
        `, [input.locationId, input.code, input.resourceId]);
        if (duplicate.rows[0]) throw DomainErrors.resourceCodeExists();
      }
      if (row.active && !input.active) {
        await this.assertNoFutureActiveBookingsForResource(client, input.resourceId);
      }
      const updated = await client.query<ScheduleResourceRow>(`
        UPDATE clinic_schema.clinic_resources
        SET code = $2,
            display_name = $3,
            resource_type = $4,
            active = $5,
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, code, display_name, resource_type, active, source, external_resource_id, version, updated_at
      `, [input.resourceId, input.code, input.displayName, input.resourceType, input.active]);
      const resource = this.toResource(updated.rows[0]);
      await this.writeOutbox(client, 'clinic.schedule.resource.updated.v1', input.correlationId, resource.id, resource.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previous: this.toResource(row),
        resource,
        employeeId: input.employee.sub,
      }, 'clinic_resource');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.resource.updated', resource.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previous: this.toResource(row),
        resource,
      }, 'clinic_resource');
      await this.completeIdempotency(client, scope, input.idempotencyKey, resource, HttpStatus.OK);
      return resource;
    });
  }

  async createPeriod(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    periodType: 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY';
    startsAt: string;
    endsAt: string;
    staffId?: string | null;
    resourceId?: string | null;
    reason?: string | null;
  }): Promise<ClinicSchedulePeriodItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.create-period:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicSchedulePeriodItem;

      if (input.staffId) await this.assertStaffBelongsToLocation(client, input.staffId, input.locationId);
      if (input.resourceId) await this.assertResourceBelongsToLocation(client, input.resourceId, input.locationId);
      const serverNow = await this.dbNow(client);
      if (new Date(input.startsAt) <= serverNow || new Date(input.endsAt) <= new Date(input.startsAt)) {
        throw DomainErrors.slotUnavailable();
      }
      if (input.periodType === 'VACATION' && !input.staffId) {
        throw DomainErrors.staffNotFound();
      }

      if (input.periodType !== 'EMERGENCY_DUTY') {
        await this.closeSlotsForBlockingPeriod(client, {
          locationId: input.locationId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          staffId: input.staffId ?? null,
          resourceId: input.resourceId ?? null,
        });
      }

      const inserted = await client.query<{ id: string }>(`
        INSERT INTO clinic_schema.schedule_periods (
          clinic_location_id, period_type, starts_at, ends_at, staff_id, resource_id,
          reason, active, source, created_by
        )
        VALUES ($1::uuid, $2, $3::timestamptz, $4::timestamptz, $5::uuid, $6::uuid, $7, true, 'MANUAL', $8::uuid)
        RETURNING id
      `, [
        input.locationId,
        input.periodType,
        input.startsAt,
        input.endsAt,
        input.staffId ?? null,
        input.resourceId ?? null,
        input.reason?.trim() ? input.reason.trim().slice(0, 500) : null,
        input.employee.sub,
      ]);
      const period = await this.reloadPeriod(client, inserted.rows[0].id);
      await this.writeOutbox(client, 'clinic.schedule.period.created.v1', input.correlationId, period.id, period.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        period,
        employeeId: input.employee.sub,
      }, 'schedule_period');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.period.created', period.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        period,
      }, 'schedule_period');
      await this.completeIdempotency(client, scope, input.idempotencyKey, period, HttpStatus.CREATED);
      return period;
    });
  }

  async cancelPeriod(input: {
    clinicId: string;
    locationId: string;
    periodId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
  }): Promise<ClinicSchedulePeriodItem> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.cancel-period:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicSchedulePeriodItem;

      const current = await client.query<SchedulePeriodRow>(`
        SELECT period.id, period.period_type, period.starts_at, period.ends_at,
               period.staff_id, staff.display_name AS staff_name,
               period.resource_id, resource.display_name AS resource_name,
               period.reason, period.active, period.source, period.version,
               period.created_at, period.updated_at
        FROM clinic_schema.schedule_periods period
        LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = period.staff_id
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = period.resource_id
        WHERE period.id = $1::uuid
          AND period.clinic_location_id = $2::uuid
        FOR UPDATE OF period
      `, [input.periodId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.schedulePeriodNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.schedulePeriodVersionStale();
      if (!row.active) {
        const period = this.toPeriod(row);
        await this.completeIdempotency(client, scope, input.idempotencyKey, period, HttpStatus.OK);
        return period;
      }

      const updated = await client.query<{ id: string }>(`
        UPDATE clinic_schema.schedule_periods
        SET active = false,
            cancelled_by = $2::uuid,
            cancelled_at = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id
      `, [input.periodId, input.employee.sub]);
      const period = await this.reloadPeriod(client, updated.rows[0].id);
      await this.writeOutbox(client, 'clinic.schedule.period.cancelled.v1', input.correlationId, period.id, period.version, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        period,
        employeeId: input.employee.sub,
      }, 'schedule_period');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.period.cancelled', period.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        period,
      }, 'schedule_period');
      await this.completeIdempotency(client, scope, input.idempotencyKey, period, HttpStatus.OK);
      return period;
    });
  }

  async importManualSlots(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    slots: Array<{
      serviceId: string;
      staffId?: string | null;
      resourceId?: string | null;
      startsAt: string;
      endsAt: string;
      capacity: number;
    }>;
  }): Promise<ClinicScheduleImportResult> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.import-manual-slots:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleImportResult;

      const serverNow = await this.dbNow(client);
      const imported: ClinicScheduleSlot[] = [];
      for (const slotInput of input.slots) {
        await this.assertServiceBelongsToLocation(client, slotInput.serviceId, input.locationId);
        if (slotInput.staffId) await this.assertStaffBelongsToLocation(client, slotInput.staffId, input.locationId);
        if (slotInput.resourceId) await this.assertResourceBelongsToLocation(client, slotInput.resourceId, input.locationId);
        if (new Date(slotInput.startsAt) <= serverNow || new Date(slotInput.endsAt) <= new Date(slotInput.startsAt)) {
          throw DomainErrors.slotUnavailable();
        }
        const inserted = await client.query<{ id: string }>(`
          INSERT INTO clinic_schema.appointment_slots (
            clinic_location_id, service_id, staff_id, resource_id, starts_at, ends_at, capacity,
            state, status, source, integration_mode, last_freshness_sync
          )
          VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz, $7,
            'OPEN', 'AVAILABLE', 'MANUAL_IMPORT', 'LEVEL_C', clock_timestamp()
          )
          RETURNING id
        `, [
          input.locationId,
          slotInput.serviceId,
          slotInput.staffId ?? null,
          slotInput.resourceId ?? null,
          slotInput.startsAt,
          slotInput.endsAt,
          slotInput.capacity,
        ]);
        imported.push(this.toSlot(await this.reloadSlot(client, inserted.rows[0].id), serverNow));
      }

      const result: ClinicScheduleImportResult = { imported: imported.length, slots: imported };
      await this.writeOutbox(client, 'clinic.schedule.import.completed.v1', input.correlationId, input.locationId, 1, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        imported: result.imported,
        slotIds: imported.map((slot) => slot.id),
        employeeId: input.employee.sub,
      }, 'clinic_location');
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.import.completed', input.locationId, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        imported: result.imported,
        slotIds: imported.map((slot) => slot.id),
      }, 'clinic_location');
      await this.completeIdempotency(client, scope, input.idempotencyKey, result, HttpStatus.CREATED);
      return result;
    });
  }

  async createManualSlot(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    serviceId: string;
    staffId?: string | null;
    resourceId?: string | null;
    startsAt: string;
    endsAt: string;
    capacity: number;
  }): Promise<ClinicScheduleSlot> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.create-manual-slot:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleSlot;

      await this.assertServiceBelongsToLocation(client, input.serviceId, input.locationId);
      if (input.staffId) await this.assertStaffBelongsToLocation(client, input.staffId, input.locationId);
      if (input.resourceId) await this.assertResourceBelongsToLocation(client, input.resourceId, input.locationId);
      const serverNow = await this.dbNow(client);
      if (new Date(input.startsAt) <= serverNow || new Date(input.endsAt) <= new Date(input.startsAt)) {
        throw DomainErrors.slotUnavailable();
      }

      const inserted = await client.query<ScheduleSlotRow>(`
        INSERT INTO clinic_schema.appointment_slots (
          clinic_location_id, service_id, staff_id, resource_id, starts_at, ends_at, capacity,
          state, status, source, integration_mode, last_freshness_sync
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz, $7,
          'OPEN', 'AVAILABLE', 'MANUAL', 'LEVEL_C', clock_timestamp()
        )
        RETURNING id, service_id, NULL::text AS service_name,
                  staff_id, NULL::text AS staff_name, resource_id, NULL::text AS resource_name,
                  starts_at, ends_at, capacity,
                  booked_count, held_count, state, status, source, integration_mode,
                  last_freshness_sync, version
      `, [input.locationId, input.serviceId, input.staffId ?? null, input.resourceId ?? null, input.startsAt, input.endsAt, input.capacity]);
      const row = await this.reloadSlot(client, inserted.rows[0].id);
      const slot = this.toSlot(row, serverNow);
      await this.writeOutbox(client, 'clinic.schedule.slot.created.v1', input.correlationId, slot.id, slot.version, {
        slotId: slot.id,
        clinicId: input.clinicId,
        locationId: input.locationId,
        serviceId: input.serviceId,
        staffId: input.staffId ?? null,
        resourceId: input.resourceId ?? null,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        capacity: slot.capacity,
        employeeId: input.employee.sub,
      });
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.slot.created', slot.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        serviceId: input.serviceId,
        staffId: input.staffId ?? null,
        resourceId: input.resourceId ?? null,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        capacity: slot.capacity,
      });
      await this.completeIdempotency(client, scope, input.idempotencyKey, slot, HttpStatus.CREATED);
      return slot;
    });
  }

  async blackoutSlot(input: {
    clinicId: string;
    locationId: string;
    slotId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    reason: string;
  }): Promise<ClinicScheduleSlot> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.blackout-slot:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleSlot;

      const current = await client.query<ScheduleSlotRow>(`
        SELECT s.id, s.service_id, service.display_name AS service_name,
               s.staff_id, staff.display_name AS staff_name,
               s.resource_id, resource.display_name AS resource_name,
               s.starts_at, s.ends_at, s.capacity, s.booked_count, s.held_count,
               s.state, s.status, s.source, s.integration_mode, s.last_freshness_sync, s.version
        FROM clinic_schema.appointment_slots s
        LEFT JOIN clinic_schema.clinic_services service ON service.id = s.service_id
        LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = s.staff_id
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = s.resource_id
        WHERE s.id = $1::uuid
          AND s.clinic_location_id = $2::uuid
        FOR UPDATE OF s
      `, [input.slotId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.slotNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
      if (row.held_count > 0 || row.booked_count > 0) throw DomainErrors.slotHasActiveBookings();

      const updated = await client.query<ScheduleSlotRow>(`
        UPDATE clinic_schema.appointment_slots
        SET state = 'CLOSED',
            status = 'AVAILABLE',
            last_freshness_sync = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, service_id, NULL::text AS service_name,
                  staff_id, NULL::text AS staff_name, resource_id, NULL::text AS resource_name,
                  starts_at, ends_at, capacity,
                  booked_count, held_count, state, status, source, integration_mode,
                  last_freshness_sync, version
      `, [input.slotId]);
      const reloaded = await this.reloadSlot(client, updated.rows[0].id);
      const slot = this.toSlot(reloaded, await this.dbNow(client));
      const reason = input.reason.trim() || 'BLACKOUT';
      await this.writeOutbox(client, 'clinic.schedule.slot.blackout.v1', input.correlationId, slot.id, slot.version, {
        slotId: slot.id,
        clinicId: input.clinicId,
        locationId: input.locationId,
        reason,
        employeeId: input.employee.sub,
      });
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.slot.blackout', slot.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        reason,
      });
      await this.completeIdempotency(client, scope, input.idempotencyKey, slot, HttpStatus.OK);
      return slot;
    });
  }

  async updateSlotCapacity(input: {
    clinicId: string;
    locationId: string;
    slotId: string;
    employee: JwtPayload;
    idempotencyKey: string;
    correlationId: string;
    expectedVersion: number;
    capacity: number;
  }): Promise<ClinicScheduleSlot> {
    return this.database.withTransaction(async (client) => {
      await this.setInteractiveTransactionLimits(client);
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const scope = `clinic.schedule.update-slot-capacity:${input.employee.sub}`;
      const replay = await this.acquireIdempotency(client, scope, input.idempotencyKey);
      if (replay) return replay as unknown as ClinicScheduleSlot;

      const current = await client.query<ScheduleSlotRow>(`
        SELECT s.id, s.service_id, service.display_name AS service_name,
               s.staff_id, staff.display_name AS staff_name,
               s.resource_id, resource.display_name AS resource_name,
               s.starts_at, s.ends_at, s.capacity, s.booked_count, s.held_count,
               s.state, s.status, s.source, s.integration_mode, s.last_freshness_sync, s.version
        FROM clinic_schema.appointment_slots s
        LEFT JOIN clinic_schema.clinic_services service ON service.id = s.service_id
        LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = s.staff_id
        LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = s.resource_id
        WHERE s.id = $1::uuid
          AND s.clinic_location_id = $2::uuid
        FOR UPDATE OF s
      `, [input.slotId, input.locationId]);
      const row = current.rows[0];
      if (!row) throw DomainErrors.slotNotFound();
      if (row.version !== input.expectedVersion) throw DomainErrors.slotVersionStale();
      if (row.held_count > 0 || row.booked_count > 0) throw DomainErrors.slotHasActiveBookings();
      if (row.state !== 'OPEN') throw DomainErrors.invalidTransition();

      const updated = await client.query<ScheduleSlotRow>(`
        UPDATE clinic_schema.appointment_slots
        SET capacity = $2,
            last_freshness_sync = clock_timestamp(),
            version = version + 1,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING id, service_id, NULL::text AS service_name,
                  staff_id, NULL::text AS staff_name, resource_id, NULL::text AS resource_name,
                  starts_at, ends_at, capacity,
                  booked_count, held_count, state, status, source, integration_mode,
                  last_freshness_sync, version
      `, [input.slotId, input.capacity]);
      const reloaded = await this.reloadSlot(client, updated.rows[0].id);
      const slot = this.toSlot(reloaded, await this.dbNow(client));
      await this.writeOutbox(client, 'clinic.schedule.slot.capacity_updated.v1', input.correlationId, slot.id, slot.version, {
        slotId: slot.id,
        clinicId: input.clinicId,
        locationId: input.locationId,
        previousCapacity: row.capacity,
        capacity: input.capacity,
        employeeId: input.employee.sub,
      });
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'clinic.schedule.slot.capacity_updated', slot.id, input.correlationId, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        previousCapacity: row.capacity,
        capacity: input.capacity,
      });
      await this.completeIdempotency(client, scope, input.idempotencyKey, slot, HttpStatus.OK);
      return slot;
    });
  }

  async recordExportAttempt(input: {
    clinicId: string;
    locationId: string;
    employee: JwtPayload;
    format: 'JSON' | 'CSV';
    scope: 'SCHEDULE' | 'SLOTS';
    rowsCount: number;
  }): Promise<ClinicScheduleExportAttemptResult> {
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      await this.assertClinicLocation(client, input.employee, input.clinicId, input.locationId);
      const serverNow = await this.dbNow(client);
      await this.writeAudit(client, 'CLINIC_EMPLOYEE', input.employee.sub, 'export.download.attempted', input.locationId, this.traceContext.getCorrelationId() ?? null, {
        clinicId: input.clinicId,
        locationId: input.locationId,
        format: input.format,
        scope: input.scope,
        rowsCount: input.rowsCount,
      }, 'clinic_location');
      return { accepted: true, serverNow: serverNow.toISOString() };
    });
  }

  private async assertClinicLocation(client: PoolClient, employee: JwtPayload, clinicId: string, locationId: string): Promise<void> {
    if (!employee.clinicIds?.includes(clinicId)) throw DomainErrors.clinicScopeMismatch();
    await this.clinicAccess.assertLocationAccess(client, employee, locationId);
    await this.assertActiveClinicLocation(client, clinicId, locationId);
  }

  private async assertScheduleSlotsReadAccess(client: PoolClient, employee: JwtPayload, clinicId: string, locationId: string): Promise<void> {
    if (!featureFlags.SCHEDULE_READ_CAPABILITY_V1) return this.assertClinicLocation(client, employee, clinicId, locationId);
    await this.clinicAccess.assertScheduleReadAccess(client, employee, clinicId, locationId);
    await this.assertActiveClinicLocation(client, clinicId, locationId);
  }

  private async assertActiveClinicLocation(client: PoolClient, clinicId: string, locationId: string): Promise<void> {
    const location = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.clinic_locations
      WHERE id = $1::uuid
        AND clinic_id = $2::uuid
        AND status = 'ACTIVE'
      FOR SHARE
    `, [locationId, clinicId]);
    if (!location.rows[0]) throw DomainErrors.clinicScopeMismatch();
  }

  private async assertServiceBelongsToLocation(client: PoolClient, serviceId: string, locationId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.clinic_services
      WHERE id = $1::uuid
        AND clinic_location_id = $2::uuid
        AND active = true
      FOR SHARE
    `, [serviceId, locationId]);
    if (!result.rows[0]) throw DomainErrors.slotUnavailable();
  }

  private async assertStaffBelongsToLocation(client: PoolClient, staffId: string, locationId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.clinic_staff
      WHERE id = $1::uuid
        AND clinic_location_id = $2::uuid
        AND active = true
      FOR SHARE
    `, [staffId, locationId]);
    if (!result.rows[0]) throw DomainErrors.staffNotFound();
  }

  private async assertResourceBelongsToLocation(client: PoolClient, resourceId: string, locationId: string): Promise<void> {
    const result = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.clinic_resources
      WHERE id = $1::uuid
        AND clinic_location_id = $2::uuid
        AND active = true
      FOR SHARE
    `, [resourceId, locationId]);
    if (!result.rows[0]) throw DomainErrors.resourceNotFound();
  }

  private async assertNoFutureActiveBookingsForService(client: PoolClient, serviceId: string): Promise<void> {
    const active = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.appointment_slots
      WHERE service_id = $1::uuid
        AND starts_at >= clock_timestamp()
        AND (held_count > 0 OR booked_count > 0)
      LIMIT 1
      FOR SHARE
    `, [serviceId]);
    if (active.rows[0]) throw DomainErrors.serviceHasActiveBookings();
  }

  private async assertNoFutureActiveBookingsForStaff(client: PoolClient, staffId: string): Promise<void> {
    const active = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.appointment_slots
      WHERE staff_id = $1::uuid
        AND starts_at >= clock_timestamp()
        AND (held_count > 0 OR booked_count > 0)
      LIMIT 1
      FOR SHARE
    `, [staffId]);
    if (active.rows[0]) throw DomainErrors.staffHasActiveBookings();
  }

  private async assertNoFutureActiveBookingsForResource(client: PoolClient, resourceId: string): Promise<void> {
    const active = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.appointment_slots
      WHERE resource_id = $1::uuid
        AND starts_at >= clock_timestamp()
        AND (held_count > 0 OR booked_count > 0)
      LIMIT 1
      FOR SHARE
    `, [resourceId]);
    if (active.rows[0]) throw DomainErrors.resourceHasActiveBookings();
  }

  private async closeSlotsForBlockingPeriod(client: PoolClient, input: {
    locationId: string;
    startsAt: string;
    endsAt: string;
    staffId: string | null;
    resourceId: string | null;
  }): Promise<void> {
    const active = await client.query<{ id: string }>(`
      SELECT id
      FROM clinic_schema.appointment_slots
      WHERE clinic_location_id = $1::uuid
        AND starts_at < $3::timestamptz
        AND ends_at > $2::timestamptz
        AND ($4::uuid IS NULL OR staff_id = $4::uuid)
        AND ($5::uuid IS NULL OR resource_id = $5::uuid)
        AND (held_count > 0 OR booked_count > 0)
      LIMIT 1
      FOR SHARE
    `, [input.locationId, input.startsAt, input.endsAt, input.staffId, input.resourceId]);
    if (active.rows[0]) throw DomainErrors.schedulePeriodHasActiveBookings();

    await client.query(`
      UPDATE clinic_schema.appointment_slots
      SET state = 'CLOSED',
          status = 'AVAILABLE',
          last_freshness_sync = clock_timestamp(),
          version = version + 1,
          updated_at = clock_timestamp()
      WHERE clinic_location_id = $1::uuid
        AND starts_at < $3::timestamptz
        AND ends_at > $2::timestamptz
        AND ($4::uuid IS NULL OR staff_id = $4::uuid)
        AND ($5::uuid IS NULL OR resource_id = $5::uuid)
        AND state = 'OPEN'
        AND held_count = 0
        AND booked_count = 0
    `, [input.locationId, input.startsAt, input.endsAt, input.staffId, input.resourceId]);
  }

  private async reloadPeriod(client: PoolClient, periodId: string): Promise<ClinicSchedulePeriodItem> {
    const result = await client.query<SchedulePeriodRow>(`
      SELECT period.id, period.period_type, period.starts_at, period.ends_at,
             period.staff_id, staff.display_name AS staff_name,
             period.resource_id, resource.display_name AS resource_name,
             period.reason, period.active, period.source, period.version,
             period.created_at, period.updated_at
      FROM clinic_schema.schedule_periods period
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = period.staff_id
      LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = period.resource_id
      WHERE period.id = $1::uuid
    `, [periodId]);
    if (!result.rows[0]) throw DomainErrors.schedulePeriodNotFound();
    return this.toPeriod(result.rows[0]);
  }

  private async readWorkingHours(client: PoolClient, locationId: string): Promise<ClinicWorkingHoursDay[]> {
    const result = await client.query<WorkingHoursRow>(`
      SELECT weekday, opens_at::text, closes_at::text, active, source, updated_at
      FROM clinic_schema.location_working_hours
      WHERE clinic_location_id = $1::uuid
      ORDER BY weekday ASC
    `, [locationId]);
    const byWeekday = new Map(result.rows.map((row) => [row.weekday, row]));
    return Array.from({ length: 7 }).map((_, weekday) => {
      const row = byWeekday.get(weekday);
      return {
        weekday,
        opensAt: row?.opens_at?.slice(0, 5) ?? (weekday >= 1 && weekday <= 5 ? '09:00' : null),
        closesAt: row?.closes_at?.slice(0, 5) ?? (weekday >= 1 && weekday <= 5 ? '18:00' : null),
        active: row?.active ?? (weekday >= 1 && weekday <= 5),
        source: row?.source ?? 'DEFAULT',
        updatedAt: row?.updated_at?.toISOString() ?? null,
      };
    });
  }

  private normalizeWorkingHours(days: Array<{ weekday: number; opensAt: string | null; closesAt: string | null; active: boolean }>): Array<{ weekday: number; opensAt: string | null; closesAt: string | null; active: boolean }> {
    if (days.length !== 7) throw DomainErrors.slotUnavailable();
    return days.map((day) => {
      if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) throw DomainErrors.slotUnavailable();
      if (!day.active) return { weekday: day.weekday, opensAt: null, closesAt: null, active: false };
      if (!this.isTime(day.opensAt) || !this.isTime(day.closesAt) || day.opensAt >= day.closesAt) throw DomainErrors.slotUnavailable();
      return { weekday: day.weekday, opensAt: day.opensAt, closesAt: day.closesAt, active: true };
    }).sort((left, right) => left.weekday - right.weekday);
  }

  private isTime(value: string | null): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private async reloadSlot(client: PoolClient, slotId: string): Promise<ScheduleSlotRow> {
    const result = await client.query<ScheduleSlotRow>(`
      SELECT s.id, s.service_id, service.display_name AS service_name,
             s.staff_id, staff.display_name AS staff_name,
             s.resource_id, resource.display_name AS resource_name,
             s.starts_at, s.ends_at, s.capacity, s.booked_count, s.held_count,
             s.state, s.status, s.source, s.integration_mode, s.last_freshness_sync, s.version
      FROM clinic_schema.appointment_slots s
      LEFT JOIN clinic_schema.clinic_services service ON service.id = s.service_id
      LEFT JOIN clinic_schema.clinic_staff staff ON staff.id = s.staff_id
      LEFT JOIN clinic_schema.clinic_resources resource ON resource.id = s.resource_id
      WHERE s.id = $1::uuid
    `, [slotId]);
    if (!result.rows[0]) throw DomainErrors.slotNotFound();
    return result.rows[0];
  }

  private toSlot(row: ScheduleSlotRow, serverNow: Date): ClinicScheduleSlot {
    const lastFreshnessSync = row.last_freshness_sync;
    return {
      id: row.id,
      service: row.service_id ? { id: row.service_id, displayName: row.service_name ?? 'Услуга' } : null,
      staff: row.staff_id ? { id: row.staff_id, displayName: row.staff_name ?? 'Специалист' } : null,
      resource: row.resource_id ? { id: row.resource_id, displayName: row.resource_name ?? 'Ресурс' } : null,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      capacity: row.capacity,
      bookedCount: row.booked_count,
      heldCount: row.held_count,
      state: row.state,
      status: row.status ?? (row.booked_count >= row.capacity ? 'BOOKED' : row.held_count > 0 ? 'LOCKED_BY_HOLD' : 'AVAILABLE'),
      source: row.source,
      integrationMode: row.integration_mode ?? 'LEVEL_C',
      lastFreshnessSync: lastFreshnessSync?.toISOString() ?? null,
      stale: lastFreshnessSync ? serverNow.getTime() - lastFreshnessSync.getTime() > 15 * 60 * 1000 : true,
      version: row.version,
      bookingHold: row.booking_hold_id && row.booking_hold_state && row.booking_hold_owner_id && row.booking_hold_pet_id
        ? {
            id: row.booking_hold_id,
            state: row.booking_hold_state,
            ownerId: row.booking_hold_owner_id,
            petId: row.booking_hold_pet_id,
          }
        : null,
    };
  }

  private toService(row: ScheduleServiceRow): ClinicScheduleServiceItem {
    return {
      id: row.id,
      code: row.code,
      displayName: row.display_name,
      durationMinutes: row.duration_minutes,
      active: row.active,
      priceAmount: row.price_amount,
      currency: row.currency,
      version: row.version,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toStaff(row: ScheduleStaffRow): ClinicScheduleStaffItem {
    return {
      id: row.id,
      code: row.code,
      displayName: row.display_name,
      role: row.role,
      active: row.active,
      source: row.source,
      externalStaffId: row.external_staff_id,
      version: row.version,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toResource(row: ScheduleResourceRow): ClinicScheduleResourceItem {
    return {
      id: row.id,
      code: row.code,
      displayName: row.display_name,
      resourceType: row.resource_type,
      active: row.active,
      source: row.source,
      externalResourceId: row.external_resource_id,
      version: row.version,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toPeriod(row: SchedulePeriodRow): ClinicSchedulePeriodItem {
    return {
      id: row.id,
      periodType: row.period_type,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      staff: row.staff_id ? { id: row.staff_id, displayName: row.staff_name ?? 'Специалист' } : null,
      resource: row.resource_id ? { id: row.resource_id, displayName: row.resource_name ?? 'Ресурс' } : null,
      reason: row.reason,
      active: row.active,
      source: row.source,
      version: row.version,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async dbNow(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now;
  }

  private async setInteractiveTransactionLimits(client: PoolClient): Promise<void> {
    await client.query("SET LOCAL lock_timeout = '50ms'");
    await client.query("SET LOCAL statement_timeout = '250ms'");
  }

  private async acquireIdempotency(client: PoolClient, scope: string, key: string): Promise<Record<string, unknown> | undefined> {
    const inserted = await client.query(`
      INSERT INTO booking_schema.idempotency_records (scope, idempotency_key, status)
      VALUES ($1, $2::uuid, 'PROCESSING') ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING id
    `, [scope, key]);
    if (inserted.rows[0]) return undefined;
    const existing = await client.query<IdempotencyRow>(`
      SELECT status, response_status, response_body
      FROM booking_schema.idempotency_records
      WHERE scope = $1 AND idempotency_key = $2::uuid
      FOR UPDATE
    `, [scope, key]);
    if (!existing.rows[0]) throw DomainErrors.bookingUnavailable();
    if (existing.rows[0].status !== 'COMPLETED' || !existing.rows[0].response_body) throw DomainErrors.idempotencyInProgress();
    return existing.rows[0].response_body;
  }

  private async completeIdempotency(client: PoolClient, scope: string, key: string, body: unknown, status: number): Promise<void> {
    await client.query(`
      UPDATE booking_schema.idempotency_records
      SET status = 'COMPLETED', response_status = $3, response_body = $4::jsonb, updated_at = clock_timestamp()
      WHERE scope = $1 AND idempotency_key = $2::uuid
    `, [scope, key, status, JSON.stringify(body)]);
  }

  private async writeOutbox(client: PoolClient, eventType: string, correlationId: string, aggregateId: string, aggregateVersion: number, payload: Record<string, unknown>, aggregateType = 'appointment_slot'): Promise<void> {
    await client.query(`
      INSERT INTO booking_schema.outbox_events (
        event_type, correlation_id, causation_id, traceparent,
        aggregate_type, aggregate_id, aggregate_version, payload_json, deduplication_key
      ) VALUES ($1, $2::uuid, $3::uuid, $4, $9, $5::uuid, $6, $7::jsonb, $8)
    `, [
      eventType,
      correlationId,
      this.traceContext.getCausationId() ?? null,
      this.traceContext.getTraceparent() ?? null,
      aggregateId,
      aggregateVersion,
      JSON.stringify(payload),
      `${eventType}:${aggregateId}:${aggregateVersion}`,
      aggregateType,
    ]);
  }

  private async writeAudit(client: PoolClient, actorType: string, actorId: string, action: string, aggregateId: string, correlationId: string | null, payload: Record<string, unknown>, aggregateType = 'appointment_slot'): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, correlation_id, payload_json)
      VALUES ($1, $2, $3, $7, $4::uuid, $5::uuid, $6::jsonb)
    `, [actorType, actorId, action, aggregateId, correlationId, JSON.stringify(payload), aggregateType]);
  }
}
