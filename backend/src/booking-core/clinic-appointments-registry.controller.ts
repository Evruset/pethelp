import { BadRequestException, Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { isClinicAppointmentsRegistryEnabled } from '../config';
import { AppointmentRegistryBucket, ClinicAppointmentsRegistryService } from './clinic-appointments-registry.service';
import { ClinicAppointmentDetailDto } from './dto/clinic-appointment-detail.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function bucketOrThrow(value: string | undefined): AppointmentRegistryBucket {
  if (value === 'upcoming' || value === 'history') return value;
  throw new BadRequestException({ code: 'INVALID_APPOINTMENT_REGISTRY_QUERY', message: 'Invalid registry query' });
}

function limitOrThrow(value: string | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException({ code: 'INVALID_APPOINTMENT_REGISTRY_QUERY', message: 'Invalid registry query' });
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new BadRequestException({ code: 'INVALID_APPOINTMENT_REGISTRY_QUERY', message: 'Invalid registry query' });
  }
  return parsed;
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicAppointmentsRegistryController {
  constructor(private readonly registry: ClinicAppointmentsRegistryService) {}

  @Get('clinic/:clinicId/locations/:locationId/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Location-scoped clinic appointments registry' })
  @ApiQuery({ name: 'bucket', required: true, enum: ['upcoming', 'history'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } })
  @ApiOkResponse({ description: 'Stable cursor page from a PostgreSQL-owned snapshot boundary.', schema: {
    type: 'object', required: ['clinicId', 'locationId', 'serverNow', 'items', 'nextCursor'], properties: {
      clinicId: { type: 'string', format: 'uuid' }, locationId: { type: 'string', format: 'uuid' }, serverNow: { type: 'string', format: 'date-time' },
      nextCursor: { type: 'string', nullable: true },
      items: { type: 'array', items: { type: 'object', required: ['appointmentId', 'aggregateVersion', 'statusCode', 'statusLabel', 'slot', 'pet', 'service'], properties: {
        appointmentId: { type: 'string', format: 'uuid' }, aggregateVersion: { type: 'integer' },
        statusCode: { type: 'string', enum: ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] }, statusLabel: { type: 'string' },
        slot: { type: 'object', required: ['startsAt', 'endsAt'], properties: { startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' } } },
        pet: { type: 'object', required: ['id', 'name', 'speciesLabel'], properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, speciesLabel: { type: 'string' } } },
        service: { type: 'object', nullable: true, required: ['displayName'], properties: { displayName: { type: 'string' } } },
      } } },
    },
  } })
  @ApiBadRequestResponse({ description: 'Bucket, limit or cursor is invalid.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Capability, clinic, location and active membership are required.' })
  list(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('bucket') bucket: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.registry.list({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      bucket: bucketOrThrow(bucket),
      limit: limitOrThrow(limit),
      cursor,
    });
  }

  @Get('clinic/:clinicId/locations/:locationId/appointments/:appointmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Location-scoped clinic appointment administrative detail' })
  @ApiOkResponse({ type: ClinicAppointmentDetailDto })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Appointment, capability, clinic, location and active membership are required.' })
  @ApiNotFoundResponse({ description: 'Appointment registry rollout is disabled.' })
  detail(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    if (!isClinicAppointmentsRegistryEnabled()) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    return this.registry.detail({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      appointmentId: idOrThrow(appointmentId),
      employee,
    });
  }
}
