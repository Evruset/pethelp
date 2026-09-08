import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { DoctorShiftInventoryService } from './doctor-shift-inventory.service';
import { DoctorMappingRequestDto, DoctorMappingResponseDto, DoctorServiceRequestDto, DoctorServiceResponseDto, DoctorShiftInventoryResponseDto, DoctorShiftRequestDto, DoctorShiftResponseDto, DoctorShiftUpdateRequestDto, InventoryGenerationResponseDto, InventoryPublicationResponseDto } from './dto/doctor-shift-openapi.dto';
import { ApiErrorDto } from './dto/booking-openapi.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
};
const optionalUuid = (value: unknown, field: string) => value == null || value === '' ? null : uuid(value, field);
const instant = (value: unknown, field: string) => {
  if (typeof value !== 'string' || (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) && Number.isNaN(Date.parse(value)))) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be an ISO datetime or clinic-local datetime.` });
  return value;
};
const boundedRange = (fromValue: unknown, toValue: unknown) => {
  const from = instant(fromValue, 'from');
  const to = instant(toValue, 'to');
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs || toMs - fromMs > 31 * 86_400_000) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'DoctorShift range must be positive and no longer than 31 days.' });
  }
  return { from, to };
};
const version = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number(value.replace(/^W\//, '').replace(/^"|"$/g, '')) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'If-Match must be a positive aggregate version.' });
  return parsed;
};

@ApiTags('Clinic Schedule Inventory')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiParam({name:'clinicId',format:'uuid'})
@ApiParam({name:'locationId',format:'uuid'})
@ApiHeader({name:'X-Correlation-ID',required:false,schema:{type:'string',format:'uuid'}})
@ApiBadRequestResponse({type:ApiErrorDto})
@ApiUnauthorizedResponse({type:ApiErrorDto})
@ApiForbiddenResponse({type:ApiErrorDto})
@ApiNotFoundResponse({type:ApiErrorDto})
@ApiConflictResponse({type:ApiErrorDto})
@ApiServiceUnavailableResponse({type:ApiErrorDto})
@ApiInternalServerErrorResponse({type:ApiErrorDto})
@Controller('v1/clinic/:clinicId/locations/:locationId/schedule')
export class DoctorShiftInventoryController {
  constructor(private readonly inventory: DoctorShiftInventoryService) {}

  @Get('doctor-shifts')
  @Roles(Role.CLINIC_ADMIN, Role.CLINIC_RECEPTIONIST, Role.CLINIC_VETERINARIAN)
  @ApiOperation({ summary: 'List DoctorShift configuration and DoctorService eligibility' })
  @ApiOkResponse({ description: 'Location-scoped schedule inventory administration projection.',type:DoctorShiftInventoryResponseDto })
  @ApiQuery({name:'from',format:'date-time'})
  @ApiQuery({name:'to',format:'date-time'})
  list(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string, @CurrentUser() employee: JwtPayload) {
    const range = boundedRange(from, to);
    return this.inventory.list({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), ...range, employee });
  }

  @Post('doctor-services')
  @Roles(Role.CLINIC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign an eligible service to a bridged doctor' })
  @ApiCreatedResponse({ description: 'DoctorService eligibility created with Pilot capacity 1.',type:DoctorServiceResponseDto })
  @ApiBody({ type: DoctorServiceRequestDto })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  createDoctorService(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string,
    @Body() body: DoctorServiceRequestDto, @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') key: string, @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.createDoctorService({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(),
      staffId: uuid(body.staffId, 'staffId'), doctorId: uuid(body.doctorId, 'doctorId'), serviceId: uuid(body.serviceId, 'serviceId'), resourceId: optionalUuid(body.resourceId, 'resourceId') });
  }

  @Post('doctor-mappings')
  @Roles(Role.CLINIC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Explicitly bridge an operational veterinarian to a same-location catalog doctor' })
  @ApiBody({type:DoctorMappingRequestDto})
  @ApiCreatedResponse({type:DoctorMappingResponseDto})
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  mapDoctor(@Param('clinicId') clinicId:string,@Param('locationId') locationId:string,@Body() body:DoctorMappingRequestDto,@CurrentUser() employee:JwtPayload,@Headers('idempotency-key') key:string,@Headers('x-correlation-id') correlation?:string){
    return this.inventory.mapDoctor({clinicId:uuid(clinicId,'clinicId'),locationId:uuid(locationId,'locationId'),employee,idempotencyKey:uuid(key,'Idempotency-Key'),correlationId:correlation?uuid(correlation,'X-Correlation-ID'):randomUUID(),staffId:uuid(body.staffId,'staffId'),doctorId:uuid(body.doctorId,'doctorId')});
  }

  @Post('doctor-shifts')
  @Roles(Role.CLINIC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft DoctorShift' })
  @ApiCreatedResponse({ description: 'Draft DoctorShift created.', type: DoctorShiftResponseDto })
  @ApiBody({ type: DoctorShiftRequestDto })
  @ApiConflictResponse({ description: 'Overlapping non-cancelled doctor shift.',type:ApiErrorDto })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  createShift(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string,
    @Body() body: DoctorShiftRequestDto, @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') key: string, @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.createShift({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(),
      staffId: uuid(body.staffId, 'staffId'), doctorId: uuid(body.doctorId, 'doctorId'), startsAt: instant(body.startsAt, 'startsAt'), endsAt: instant(body.endsAt, 'endsAt') });
  }

  @Post('doctor-shifts/:shiftId')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Update a DoctorShift using optimistic version fencing' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiParam({name:'shiftId',format:'uuid'})
  @ApiBody({ type: DoctorShiftUpdateRequestDto })
  @ApiOkResponse({ type: DoctorShiftResponseDto })
  updateShift(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('shiftId') shiftId: string,
    @Body() body: DoctorShiftUpdateRequestDto, @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string,
    @Headers('if-match') ifMatch: string, @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.updateShift({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), shiftId: uuid(shiftId, 'shiftId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(), expectedVersion: version(ifMatch),
      startsAt: instant(body.startsAt, 'startsAt'), endsAt: instant(body.endsAt, 'endsAt') });
  }

  @Post('doctor-shifts/:shiftId/generate')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Deterministically generate draft canonical slots' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiParam({name:'shiftId',format:'uuid'})
  @ApiOkResponse({ type: InventoryGenerationResponseDto })
  generate(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('shiftId') shiftId: string,
    @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string, @Headers('if-match') ifMatch: string,
    @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.generate({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), shiftId: uuid(shiftId, 'shiftId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(), expectedVersion: version(ifMatch) });
  }

  @Post('inventory-runs/:runId/publish')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Publish one generated inventory run to Owner availability' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiParam({name:'runId',format:'uuid'})
  @ApiOkResponse({ type: InventoryPublicationResponseDto })
  publish(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('runId') runId: string,
    @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string, @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.publish({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), runId: uuid(runId, 'runId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID() });
  }

  @Post('inventory-runs/:runId/unpublish')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Remove a generated run from Owner availability without deleting booked history' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiParam({name:'runId',format:'uuid'})
  @ApiOkResponse({ type: InventoryPublicationResponseDto })
  unpublish(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('runId') runId: string,
    @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string, @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.unpublish({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), runId: uuid(runId, 'runId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID() });
  }

  @Post('doctor-shifts/:shiftId/block')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Block a DoctorShift and all of its generated availability' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiParam({name:'shiftId',format:'uuid'})
  @ApiOkResponse({ type: DoctorShiftResponseDto })
  block(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('shiftId') shiftId: string,
    @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string, @Headers('if-match') ifMatch: string,
    @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.block({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), shiftId: uuid(shiftId, 'shiftId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(), expectedVersion: version(ifMatch) });
  }

  @Post('doctor-shifts/:shiftId/cancel')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Cancel a DoctorShift while preserving generated booking history' })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiParam({name:'shiftId',format:'uuid'})
  @ApiOkResponse({ type: DoctorShiftResponseDto })
  cancel(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @Param('shiftId') shiftId: string,
    @CurrentUser() employee: JwtPayload, @Headers('idempotency-key') key: string, @Headers('if-match') ifMatch: string,
    @Headers('x-correlation-id') correlation?: string) {
    return this.inventory.cancel({ clinicId: uuid(clinicId, 'clinicId'), locationId: uuid(locationId, 'locationId'), shiftId: uuid(shiftId, 'shiftId'), employee,
      idempotencyKey: uuid(key, 'Idempotency-Key'), correlationId: correlation ? uuid(correlation, 'X-Correlation-ID') : randomUUID(), expectedVersion: version(ifMatch) });
  }
}
