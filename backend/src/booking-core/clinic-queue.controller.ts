import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicQueueService } from './clinic-queue.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function parseLimit(value: string | undefined): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicQueueController {
  constructor(private readonly queue: ClinicQueueService) {}

  @Get('clinic/:clinicId/locations/:locationId/booking-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'FIFO queue for Level-C manual confirmations' })
  @ApiOkResponse({ description: 'Strict FIFO response with PostgreSQL server time for the SLA countdown.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Clinic and location scope are enforced through JWT claims and active membership.' })
  async getManualConfirmationQueue(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.queue.listManualConfirmationQueue({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      limit: parseLimit(limit),
    });
  }
}
