import { randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, Controller, Headers, HttpException, NotFoundException, Param, Patch,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiExtension,
  ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiParam, ApiResponse, ApiTags, ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { isClinicPatientAdminMutationsEnabled } from '../config';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicPatientLocalAliasService } from './clinic-patient-local-alias.service';
import {
  ClinicPatientLocalAliasDto,
  UpdateClinicPatientLocalAliasRequestDto,
} from './dto/update-clinic-patient-local-alias.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^(0|[1-9]\d*)$/;
const unavailable = (): never => {
  throw new NotFoundException({ code: 'PATIENT_RESOURCE_UNAVAILABLE', message: 'Patient resource unavailable' });
};

function uuid(value: string | undefined, name: string): string {
  if (!value || !UUID.test(value)) {
    if (name === 'patientId' || name === 'clinicId' || name === 'locationId') return unavailable();
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${name} must be a UUID` });
  }
  return value;
}

function version(value: string | undefined): number {
  const match = value?.match(/^"(0|[1-9]\d*)"$/);
  if (!match || !VERSION.test(match[1])) {
    throw new DomainPreconditionRequired();
  }
  const parsed = Number(match[1]);
  if (!Number.isSafeInteger(parsed)) throw new DomainPreconditionRequired();
  return parsed;
}

function alias(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body as object).length !== 1 || !Object.hasOwn(body, 'alias')) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Only alias is accepted' });
  }
  const value = (body as { alias: unknown }).alias;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new UnprocessableEntityException({ code: 'INVALID_PATIENT_ALIAS', message: 'Alias is invalid' });
  }
  const normalized = value.normalize('NFC').trim();
  if (Array.from(normalized).length < 1 || Array.from(normalized).length > 80
    || /[\u0000-\u001f\u007f-\u009f\r\n]/u.test(normalized)) {
    throw new UnprocessableEntityException({ code: 'INVALID_PATIENT_ALIAS', message: 'Alias is invalid' });
  }
  return normalized;
}

class DomainPreconditionRequired extends HttpException {
  constructor() {
    super({ code: 'PRECONDITION_REQUIRED', message: 'If-Match is required' }, 428);
  }
}

@ApiTags('Clinic Patients')
@Controller('v1')
export class ClinicPatientLocalAliasController {
  constructor(private readonly service: ClinicPatientLocalAliasService) {}

  @Patch('clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiExtension('x-required-capabilities', [Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE])
  @ApiOperation({ summary: 'Set or clear an exact-scope clinic-local patient alias' })
  @ApiParam({ name: 'clinicId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'locationId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'patientId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"0"' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['alias'],
      properties: { alias: { type: 'string', nullable: true, minLength: 1, maxLength: 80 } },
    },
  })
  @ApiOkResponse({ type: ClinicPatientLocalAliasDto })
  @ApiBadRequestResponse({ description: 'Malformed IDs, headers or strict alias DTO.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Mutation capability and exact active membership are required.' })
  @ApiNotFoundResponse({ description: 'Rollout disabled or patient unavailable in the current exact scope.' })
  @ApiConflictResponse({ description: 'Stale version or idempotency-key payload mismatch.' })
  @ApiUnprocessableEntityResponse({ description: 'Disallowed patient field class.' })
  @ApiResponse({ status: 428, description: 'If-Match is required.' })
  @ApiResponse({ status: 503, description: 'Visibility policy is unavailable.' })
  update(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('patientId') patientId: string,
    @Body() body: UpdateClinicPatientLocalAliasRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ): Promise<ClinicPatientLocalAliasDto> {
    if (!isClinicPatientAdminMutationsEnabled()) return unavailable();
    return this.service.update({
      clinicId: uuid(clinicId, 'clinicId'),
      locationId: uuid(locationId, 'locationId'),
      patientId: uuid(patientId, 'patientId'),
      employee,
      alias: alias(body),
      expectedVersion: version(ifMatch),
      idempotencyKey: uuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: correlationId && UUID.test(correlationId) ? correlationId : randomUUID(),
    });
  }
}
