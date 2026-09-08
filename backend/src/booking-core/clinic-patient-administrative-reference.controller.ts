import { randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, Controller, Headers, HttpException, NotFoundException, Param, Patch,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiExtension, ApiForbiddenResponse,
  ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags,
  ApiUnauthorizedResponse, ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { isClinicPatientAdminMutationsEnabled } from '../config';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { normalizeAdministrativeReference } from './clinic-patient-administrative-reference.normalizer';
import { ClinicPatientAdministrativeReferenceService } from './clinic-patient-administrative-reference.service';
import {
  ClinicPatientAdministrativeReferenceDto,
  UpdateClinicPatientAdministrativeReferenceRequestDto,
} from './dto/update-clinic-patient-administrative-reference.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = (): never => {
  throw new NotFoundException({ code: 'PATIENT_RESOURCE_UNAVAILABLE', message: 'Patient resource unavailable' });
};
const uuid = (value: string | undefined, resource = false): string => {
  if (!value || !UUID.test(value)) {
    if (resource) return unavailable();
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Header must be a UUID' });
  }
  return value;
};
const version = (value: string | undefined): number => {
  const match = /^"(0|[1-9]\d*)"$/.exec(value ?? '');
  const parsed = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new HttpException({ code: 'PRECONDITION_REQUIRED', message: 'If-Match is required' }, 428);
  }
  return parsed;
};
function reference(body: unknown): { display: string | null; comparisonKey: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body as object).length !== 1 || !Object.hasOwn(body, 'administrativeReference')) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Only administrativeReference is accepted' });
  }
  const value = (body as { administrativeReference: unknown }).administrativeReference;
  if (value === null) return { display: null, comparisonKey: null };
  const normalized = typeof value === 'string' ? normalizeAdministrativeReference(value) : null;
  if (!normalized) {
    throw new UnprocessableEntityException({
      code: 'INVALID_ADMINISTRATIVE_REFERENCE', message: 'Administrative reference is invalid',
    });
  }
  return normalized;
}

@ApiTags('Clinic Patients')
@Controller('v1')
export class ClinicPatientAdministrativeReferenceController {
  constructor(private readonly service: ClinicPatientAdministrativeReferenceService) {}

  @Patch('clinic/:clinicId/locations/:locationId/patients/:patientId/local-profile/reference')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiExtension('x-required-capabilities', [Capability.PATIENT_ADMIN_LOCAL_PROFILE_UPDATE])
  @ApiOperation({ summary: 'Set or clear an exact-scope clinic patient administrative reference' })
  @ApiParam({ name: 'clinicId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'locationId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'patientId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"0"' } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    schema: {
      type: 'object', additionalProperties: false, required: ['administrativeReference'],
      properties: { administrativeReference: { type: 'string', nullable: true, minLength: 1, maxLength: 40 } },
    },
  })
  @ApiOkResponse({ type: ClinicPatientAdministrativeReferenceDto })
  @ApiBadRequestResponse({ description: 'Malformed headers or strict DTO.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Mutation capability is required.' })
  @ApiNotFoundResponse({ description: 'Rollout disabled or patient unavailable in the exact scope.' })
  @ApiConflictResponse({ description: 'Stale version, collision, association change or key reuse.' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid administrative reference.' })
  @ApiResponse({ status: 428, description: 'A strong If-Match is required.' })
  @ApiResponse({ status: 503, description: 'Visibility policy is unavailable.' })
  update(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('patientId') patientId: string,
    @Body() body: UpdateClinicPatientAdministrativeReferenceRequestDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ): Promise<ClinicPatientAdministrativeReferenceDto> {
    if (!isClinicPatientAdminMutationsEnabled()) return unavailable();
    const normalized = reference(body);
    return this.service.update({
      clinicId: uuid(clinicId, true), locationId: uuid(locationId, true), patientId: uuid(patientId, true),
      employee, administrativeReference: normalized.display, comparisonKey: normalized.comparisonKey,
      expectedVersion: version(ifMatch), idempotencyKey: uuid(idempotencyKey),
      correlationId: correlationId && UUID.test(correlationId) ? correlationId : randomUUID(),
    });
  }
}
