import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicScheduleService } from './clinic-schedule.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string): value is string => Boolean(value && UUID.test(value));

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function requiredUuid(value: string | undefined, field: string): string {
  if (!isUuid(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !isUuid(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

function requiredVersion(value: string | undefined, field: string): number {
  const normalized = value?.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  const parsed = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== normalized) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a positive aggregate version.` });
  }
  return parsed;
}

function dateOrThrow(value: string | undefined, field: string): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be an ISO datetime.` });
  }
  return new Date(value).toISOString();
}

function capacityOrThrow(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'capacity must be an integer from 1 to 50.' });
  }
  return parsed;
}

function durationOrThrow(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 5 || parsed > 480) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'durationMinutes must be an integer from 5 to 480.' });
  }
  return parsed;
}

function serviceCodeOrThrow(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'code must be a string.' });
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'code must be 2-64 latin letters, numbers, underscores or hyphens.' });
  }
  return normalized;
}

function serviceNameOrThrow(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'displayName must be a string.' });
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 120) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'displayName must be 2-120 characters.' });
  }
  return normalized;
}

function priceAmountOrThrow(value: unknown): string {
  const text = typeof value === 'number' ? value.toFixed(2) : typeof value === 'string' ? value.trim().replace(',', '.') : '';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'priceAmount must be a positive decimal with up to 2 fraction digits.' });
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'priceAmount must be positive.' });
  }
  return parsed.toFixed(2);
}

function currencyOrThrow(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value.trim())) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'currency must be an ISO 4217 code.' });
  }
  return value.trim();
}

function scheduleRoleOrThrow(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'role must be a string.' });
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'role must be 2-40 uppercase letters, numbers or underscores.' });
  }
  return normalized;
}

function resourceTypeOrThrow(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'resourceType must be a string.' });
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'resourceType must be 2-40 uppercase letters, numbers or underscores.' });
  }
  return normalized;
}

function serviceBodyOrThrow(body: { code?: unknown; displayName?: unknown; durationMinutes?: unknown; priceAmount?: unknown; currency?: unknown; active?: unknown }) {
  return {
    code: serviceCodeOrThrow(body.code),
    displayName: serviceNameOrThrow(body.displayName),
    durationMinutes: durationOrThrow(body.durationMinutes),
    priceAmount: priceAmountOrThrow(body.priceAmount),
    currency: currencyOrThrow(body.currency),
    active: body.active === true,
  };
}

function staffBodyOrThrow(body: { code?: unknown; displayName?: unknown; role?: unknown; active?: unknown }) {
  return {
    code: serviceCodeOrThrow(body.code),
    displayName: serviceNameOrThrow(body.displayName),
    role: scheduleRoleOrThrow(body.role),
    active: body.active === true,
  };
}

function resourceBodyOrThrow(body: { code?: unknown; displayName?: unknown; resourceType?: unknown; active?: unknown }) {
  return {
    code: serviceCodeOrThrow(body.code),
    displayName: serviceNameOrThrow(body.displayName),
    resourceType: resourceTypeOrThrow(body.resourceType),
    active: body.active === true,
  };
}

function periodTypeOrThrow(value: unknown): 'BLACKOUT' | 'VACATION' | 'EMERGENCY_DUTY' {
  if (value === 'BLACKOUT' || value === 'VACATION' || value === 'EMERGENCY_DUTY') return value;
  throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'periodType must be BLACKOUT, VACATION or EMERGENCY_DUTY.' });
}

function periodBodyOrThrow(body: {
  periodType?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  staffId?: unknown;
  resourceId?: unknown;
  reason?: unknown;
}) {
  return {
    periodType: periodTypeOrThrow(body.periodType),
    startsAt: dateOrThrow(typeof body.startsAt === 'string' ? body.startsAt : undefined, 'startsAt'),
    endsAt: dateOrThrow(typeof body.endsAt === 'string' ? body.endsAt : undefined, 'endsAt'),
    staffId: optionalUuid(body.staffId, 'staffId'),
    resourceId: optionalUuid(body.resourceId, 'resourceId'),
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
  };
}

function importSlotsOrThrow(value: unknown): Array<{ serviceId: string; staffId: string | null; resourceId: string | null; startsAt: string; endsAt: string; capacity: number }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'slots must contain 1-100 entries.' });
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Invalid slot entry.' });
    }
    const row = item as { serviceId?: unknown; staffId?: unknown; resourceId?: unknown; startsAt?: unknown; endsAt?: unknown; capacity?: unknown };
    return {
      serviceId: requiredUuid(typeof row.serviceId === 'string' ? row.serviceId : undefined, 'serviceId'),
      staffId: optionalUuid(row.staffId, 'staffId'),
      resourceId: optionalUuid(row.resourceId, 'resourceId'),
      startsAt: dateOrThrow(typeof row.startsAt === 'string' ? row.startsAt : undefined, 'startsAt'),
      endsAt: dateOrThrow(typeof row.endsAt === 'string' ? row.endsAt : undefined, 'endsAt'),
      capacity: capacityOrThrow(row.capacity),
    };
  });
}

function workingHoursOrThrow(value: unknown): Array<{ weekday: number; opensAt: string | null; closesAt: string | null; active: boolean }> {
  if (!Array.isArray(value) || value.length !== 7) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'days must contain seven weekday entries.' });
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Invalid working hours entry.' });
    }
    const row = item as { weekday?: unknown; opensAt?: unknown; closesAt?: unknown; active?: unknown };
    return {
      weekday: Number(row.weekday),
      opensAt: typeof row.opensAt === 'string' ? row.opensAt : null,
      closesAt: typeof row.closesAt === 'string' ? row.closesAt : null,
      active: row.active === true,
    };
  });
}

function exportAttemptBodyOrThrow(body: { format?: unknown; scope?: unknown; rowsCount?: unknown }): { format: 'JSON' | 'CSV'; scope: 'SCHEDULE' | 'SLOTS'; rowsCount: number } {
  const format = body.format === 'JSON' || body.format === 'CSV' ? body.format : null;
  const scope = body.scope === 'SCHEDULE' || body.scope === 'SLOTS' ? body.scope : null;
  const rowsCount = typeof body.rowsCount === 'number' ? body.rowsCount : Number(body.rowsCount);
  if (!format || !scope || !Number.isInteger(rowsCount) || rowsCount < 0 || rowsCount > 100_000) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'format, scope and rowsCount are required.' });
  }
  return { format, scope, rowsCount };
}

@ApiTags('Clinic Schedule')
@Controller('v1')
export class ClinicScheduleController {
  constructor(private readonly schedule: ClinicScheduleService) {}

  @Get('clinic/:clinicId/locations/:locationId/schedule/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Clinic schedule slots for a location' })
  @ApiOkResponse({ description: 'Slots include source, integration mode, freshness and current counters.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async listSlots(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.schedule.listSlots({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      from: dateOrThrow(from, 'from'),
      to: dateOrThrow(to, 'to'),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/export-attempts')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Audit a clinic schedule export/download attempt' })
  @ApiOkResponse({ description: 'Export attempt has been appended to audit log.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async recordExportAttempt(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { format?: unknown; scope?: unknown; rowsCount?: unknown },
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.schedule.recordExportAttempt({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      ...exportAttemptBodyOrThrow(body),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/manual-slots')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create a manual Level-C appointment slot' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Manual slot created and audited.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async createManualSlot(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { serviceId?: unknown; staffId?: unknown; resourceId?: unknown; startsAt?: unknown; endsAt?: unknown; capacity?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.schedule.createManualSlot({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      serviceId: requiredUuid(typeof body.serviceId === 'string' ? body.serviceId : undefined, 'serviceId'),
      staffId: optionalUuid(body.staffId, 'staffId'),
      resourceId: optionalUuid(body.resourceId, 'resourceId'),
      startsAt: dateOrThrow(typeof body.startsAt === 'string' ? body.startsAt : undefined, 'startsAt'),
      endsAt: dateOrThrow(typeof body.endsAt === 'string' ? body.endsAt : undefined, 'endsAt'),
      capacity: capacityOrThrow(body.capacity),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/services')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create a clinic location service for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Service created and audited.' })
  @ApiConflictResponse({ description: 'SERVICE_CODE_EXISTS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async createService(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { code?: unknown; displayName?: unknown; durationMinutes?: unknown; priceAmount?: unknown; currency?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const service = serviceBodyOrThrow(body);
    return this.schedule.createService({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      ...service,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/services/:serviceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update a clinic location service for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Service updated and audited.' })
  @ApiConflictResponse({ description: 'SERVICE_VERSION_STALE, SERVICE_CODE_EXISTS or SERVICE_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async updateService(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('serviceId') serviceId: string,
    @Body() body: { code?: unknown; displayName?: unknown; durationMinutes?: unknown; priceAmount?: unknown; currency?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const service = serviceBodyOrThrow(body);
    return this.schedule.updateService({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      serviceId: idOrThrow(serviceId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      ...service,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/staff')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create a clinic location staff member for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Staff member created and audited.' })
  @ApiConflictResponse({ description: 'STAFF_CODE_EXISTS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async createStaff(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { code?: unknown; displayName?: unknown; role?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const staff = staffBodyOrThrow(body);
    return this.schedule.createStaff({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      ...staff,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/staff/:staffId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update a clinic location staff member for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Staff member updated and audited.' })
  @ApiConflictResponse({ description: 'STAFF_VERSION_STALE, STAFF_CODE_EXISTS or STAFF_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async updateStaff(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('staffId') staffId: string,
    @Body() body: { code?: unknown; displayName?: unknown; role?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const staff = staffBodyOrThrow(body);
    return this.schedule.updateStaff({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      staffId: idOrThrow(staffId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      ...staff,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/resources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create a clinic location resource for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Resource created and audited.' })
  @ApiConflictResponse({ description: 'RESOURCE_CODE_EXISTS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async createResource(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { code?: unknown; displayName?: unknown; resourceType?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const resource = resourceBodyOrThrow(body);
    return this.schedule.createResource({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      ...resource,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/resources/:resourceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update a clinic location resource for schedule management' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Resource updated and audited.' })
  @ApiConflictResponse({ description: 'RESOURCE_VERSION_STALE, RESOURCE_CODE_EXISTS or RESOURCE_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async updateResource(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('resourceId') resourceId: string,
    @Body() body: { code?: unknown; displayName?: unknown; resourceType?: unknown; active?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const resource = resourceBodyOrThrow(body);
    return this.schedule.updateResource({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      resourceId: idOrThrow(resourceId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      ...resource,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/periods')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create a schedule period: blackout, staff vacation or emergency duty' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Schedule period created and audited. Blocking periods close empty overlapping slots.' })
  @ApiConflictResponse({ description: 'SCHEDULE_PERIOD_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async createPeriod(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { periodType?: unknown; startsAt?: unknown; endsAt?: unknown; staffId?: unknown; resourceId?: unknown; reason?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const period = periodBodyOrThrow(body);
    return this.schedule.createPeriod({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      ...period,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/periods/:periodId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Cancel an active schedule period without reopening closed slots' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Schedule period cancelled and audited.' })
  @ApiConflictResponse({ description: 'SCHEDULE_PERIOD_VERSION_STALE.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async cancelPeriod(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('periodId') periodId: string,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.schedule.cancelPeriod({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      periodId: idOrThrow(periodId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/import')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Import manual Level-C appointment slots from JSON' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ description: 'Manual slots imported and audited.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async importManualSlots(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { slots?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.schedule.importManualSlots({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      slots: importSlotsOrThrow(body.slots),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/working-hours')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update weekly working hours for a clinic location' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Working hours updated and audited.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async updateWorkingHours(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Body() body: { days?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.schedule.updateWorkingHours({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      days: workingHoursOrThrow(body.days),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/slots/:slotId/blackout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Close a slot as blackout when it has no active holds or bookings' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Slot closed and audited.' })
  @ApiConflictResponse({ description: 'SLOT_VERSION_STALE or SLOT_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async blackoutSlot(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('slotId') slotId: string,
    @Body() body: { reason?: unknown } | undefined,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : 'BLACKOUT';
    return this.schedule.blackoutSlot({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      slotId: idOrThrow(slotId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      reason,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/schedule/slots/:slotId/capacity')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update slot capacity when it has no active holds or bookings' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Slot capacity updated and audited.' })
  @ApiConflictResponse({ description: 'SLOT_VERSION_STALE or SLOT_HAS_ACTIVE_BOOKINGS.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async updateSlotCapacity(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('slotId') slotId: string,
    @Body() body: { capacity?: unknown },
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.schedule.updateSlotCapacity({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      slotId: idOrThrow(slotId),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      capacity: capacityOrThrow(body.capacity),
    });
  }
}
