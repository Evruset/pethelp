import { ArgumentsHost, BadRequestException, Catch, Controller, ExceptionFilter, Get, NotFoundException, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiExtension, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DomainErrors } from '../common/domain-error';
import { isClinicPatientsRegistryEnabled } from '../config';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicPatientsRegistryDto } from './dto/clinic-patients-registry.dto';
import { ClinicPatientsRegistryService, PatientsRegistryRateLimitException } from './clinic-patients-registry.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function scopedId(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function limit(value?: string): number {
  if (value === undefined) return 50;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 100) {
    throw new BadRequestException({ code: 'INVALID_PATIENTS_REGISTRY_QUERY', message: 'Invalid registry query' });
  }
  return Number(value);
}

function search(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase('und');
  const length = Array.from(normalized).length;
  if (length < 2 || length > 80 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_PATIENTS_REGISTRY_QUERY', message: 'Invalid registry query' });
  }
  return normalized;
}

@Catch(PatientsRegistryRateLimitException)
class PatientsRegistryRateLimitFilter implements ExceptionFilter {
  catch(error: PatientsRegistryRateLimitException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    response.setHeader('Retry-After', String(error.retryAfter));
    response.status(error.getStatus()).json({ statusCode: error.getStatus(), ...error.getResponse() as object });
  }
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicPatientsRegistryController {
  constructor(private readonly registry: ClinicPatientsRegistryService) {}

  @Get('clinic/:clinicId/locations/:locationId/patients')
  @UseFilters(PatientsRegistryRateLimitFilter)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiExtension('x-required-capabilities', [Capability.PATIENT_ADMIN_READ])
  @ApiOperation({ summary: 'Location-scoped clinic patients administrative registry' })
  @ApiQuery({ name: 'q', required: false, schema: { type: 'string', minLength: 2, maxLength: 80 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } })
  @ApiOkResponse({ type: ClinicPatientsRegistryDto })
  @ApiBadRequestResponse({ description: 'Query or cursor is invalid.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Capability and exact active location membership are required.' })
  @ApiNotFoundResponse({ description: 'Patients registry rollout is disabled.' })
  @ApiResponse({ status: 429, description: 'Search rate limit exceeded.', headers: { 'Retry-After': { schema: { type: 'integer' } } } })
  @ApiResponse({ status: 503, description: 'Visibility or search policy is unavailable.' })
  list(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('q') q: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    if (!isClinicPatientsRegistryEnabled()) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    return this.registry.list({
      clinicId: scopedId(clinicId),
      locationId: scopedId(locationId),
      employee,
      q: search(q),
      limit: limit(rawLimit),
      cursor,
    });
  }
}
