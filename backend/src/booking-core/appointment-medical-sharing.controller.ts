import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApiErrorDto } from './dto/booking-openapi.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload, Role } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { AppointmentMedicalSharingService, MedicalResourceRef, MedicalSelection } from './appointment-medical-sharing.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idSchema = { type: 'string', format: 'uuid' };
const dateSchema = { type: 'string', format: 'date-time' };
const refSchema = { type: 'object', additionalProperties: false, required: ['type', 'id'], properties: {
  type: { type: 'string', enum: ['RESULT', 'AMENDMENT', 'DOCUMENT'] }, id: idSchema,
} };
const refsSchema = { type: 'array', items: refSchema };
const shareSchema = { type: 'object', additionalProperties: false,
  required: ['id', 'appointmentId', 'petId', 'clinicId', 'locationId', 'status', 'version', 'createdAt', 'revokedAt', 'resources'],
  properties: { id: idSchema, appointmentId: idSchema, petId: idSchema, clinicId: idSchema, locationId: idSchema,
    status: { type: 'string', enum: ['ACTIVE', 'REVOKED'] }, version: { type: 'integer', minimum: 1 },
    createdAt: dateSchema, revokedAt: { ...dateSchema, nullable: true }, resources: refsSchema },
};
const resourceSchema: SchemaObject = { oneOf: [
  { type: 'object', additionalProperties: false, required: ['type', 'id', 'content', 'publishedAt'], properties: {
    type: { type: 'string', enum: ['RESULT'] }, id: idSchema, content: { type: 'string' }, publishedAt: dateSchema,
  } },
  { type: 'object', additionalProperties: false, required: ['type', 'id', 'content', 'publishedAt', 'version'], properties: {
    type: { type: 'string', enum: ['AMENDMENT'] }, id: idSchema, content: { type: 'string' }, publishedAt: dateSchema, version: { type: 'integer', minimum: 1 },
  } },
  { type: 'object', additionalProperties: false, required: ['type', 'id', 'fileName', 'mimeType', 'createdAt'], properties: {
    type: { type: 'string', enum: ['DOCUMENT'] }, id: idSchema, fileName: { type: 'string', nullable: true }, mimeType: { type: 'string', nullable: true }, createdAt: dateSchema,
  } },
] };
function uuid(value: string | undefined) {
  if (!value || !UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST' });
  return value.toLowerCase();
}
function version(value: string | undefined) {
  const parsed = Number(value?.trim().replace(/^W\//, '').replace(/^"|"$/g, ''));
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequestException({ code: 'INVALID_REQUEST' });
  return parsed;
}

@ApiTags('Appointment medical sharing')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@ApiBadRequestResponse({ type: ApiErrorDto })
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@ApiNotFoundResponse({ type: ApiErrorDto })
@ApiConflictResponse({ type: ApiErrorDto })
@ApiInternalServerErrorResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/appointments/:appointmentId/medical-shares')
export class OwnerAppointmentMedicalSharingController {
  constructor(private readonly service: AppointmentMedicalSharingService) {}

  @Get()
  @ApiOperation({ operationId: 'MedicalShare_ownerContext' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: false,
    required: ['appointmentId', 'petId', 'clinicId', 'locationId', 'eligible', 'resources', 'resourcesTruncated', 'shares','clinic','pet','appointment','resourceDetails'], properties: {
      appointmentId: idSchema, petId: idSchema, clinicId: idSchema, locationId: idSchema,
      eligible: { type: 'boolean' }, resourcesTruncated: { type: 'boolean' }, resources: refsSchema, shares: { type: 'array', items: shareSchema },
      clinic:{type:'object',additionalProperties:false,required:['displayName','locationAddress'],properties:{displayName:{type:'string'},locationAddress:{type:'string'}}},
      pet:{type:'object',additionalProperties:false,required:['displayName'],properties:{displayName:{type:'string'}}},
      appointment:{type:'object',additionalProperties:false,required:['startsAt','endsAt','timezone'],properties:{startsAt:dateSchema,endsAt:dateSchema,timezone:{type:'string'}}},
      resourceDetails:{type:'array',items:{type:'object',additionalProperties:false,required:['type','id','label','createdAt'],properties:{...refSchema.properties,label:{type:'string'},createdAt:dateSchema}}},
    },
  } })
  context(@Param('appointmentId') appointment: string, @CurrentUser() actor: JwtPayload) {
    return this.service.ownerContext(uuid(appointment), actor);
  }

  @Post()
  @ApiOperation({ operationId: 'MedicalShare_create' })
  @ApiCreatedResponse({ schema: shareSchema })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: { oneOf: [
    { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { type: 'string', enum: ['ALL_CURRENT'] } } },
    { type: 'object', additionalProperties: false, required: ['mode', 'resources'], properties: {
      mode: { type: 'string', enum: ['SELECTED'] }, resources: { type: 'array', minItems: 1, maxItems: 200, items: {
        type: 'object', additionalProperties: false, required: ['type', 'id'], properties: {
          type: { type: 'string', enum: ['RESULT', 'AMENDMENT', 'DOCUMENT'] }, id: { type: 'string', format: 'uuid' },
        },
      } },
    } },
  ] } })
  create(@Param('appointmentId') appointment: string, @Body() body: MedicalSelection,
    @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlation: string | undefined,
    @CurrentUser() actor: JwtPayload) {
    return this.service.create(uuid(appointment), body, uuid(key), actor, uuid(correlation));
  }

  @Post(':shareId/revoke')
  @HttpCode(200)
  @ApiOperation({ operationId: 'MedicalShare_revoke' })
  @ApiOkResponse({ schema: shareSchema })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"1"' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, maxProperties: 0 } })
  revoke(@Param('appointmentId') appointment: string, @Param('shareId') share: string,
    @Body() body: unknown, @Headers('if-match') match: string | undefined,
    @Headers('idempotency-key') key: string | undefined, @Headers('x-correlation-id') correlation: string | undefined,
    @CurrentUser() actor: JwtPayload) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    return this.service.revoke(uuid(appointment), uuid(share), version(match), uuid(key), actor, uuid(correlation));
  }
}

@ApiTags('Appointment medical sharing')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@ApiBadRequestResponse({ type: ApiErrorDto })
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto })
@ApiNotFoundResponse({ type: ApiErrorDto })
@ApiInternalServerErrorResponse({ type: ApiErrorDto })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLINIC_VETERINARIAN)
@Controller('v1/clinic/appointments/:appointmentId/medical-shares')
export class ClinicAppointmentMedicalSharingController {
  constructor(private readonly service: AppointmentMedicalSharingService) {}

  @Get()
  @ApiOperation({ operationId: 'MedicalShare_clinicList' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: false, required: ['appointmentId', 'status', 'resources'], properties: {
    appointmentId: idSchema, status: { type: 'string', enum: ['SHARED', 'NOT_SHARED'] }, resources: refsSchema,
  } } })
  list(@Param('appointmentId') appointment: string, @CurrentUser() actor: JwtPayload) {
    return this.service.clinicList(uuid(appointment), actor);
  }

  @Get('resources/:resourceType/:resourceId')
  @ApiOperation({ operationId: 'MedicalShare_clinicRead' })
  @ApiOkResponse({ schema: resourceSchema })
  read(@Param('appointmentId') appointment: string, @Param('resourceType') type: string,
    @Param('resourceId') id: string, @CurrentUser() actor: JwtPayload) {
    if (!['RESULT', 'AMENDMENT', 'DOCUMENT'].includes(type)) throw new BadRequestException({ code: 'INVALID_REQUEST' });
    return this.service.clinicRead(uuid(appointment), { type: type as MedicalResourceRef['type'], id: uuid(id) }, actor);
  }
}
