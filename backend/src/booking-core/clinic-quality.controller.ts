import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload, Role } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicQualityService } from './clinic-quality.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function dateOrThrow(value: string | undefined, field: string): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be an ISO datetime.` });
  }
  return new Date(value).toISOString();
}

@ApiTags('Clinic Quality')
@Controller('v1')
export class ClinicQualityController {
  constructor(private readonly quality: ClinicQualityService) {}

  @Get('clinic/:clinicId/locations/:locationId/quality-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Clinic service quality metrics for a location and date range' })
  @ApiOkResponse({ description: 'Quality metrics with numerator and denominator for each ratio.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope mismatch.' })
  async dashboard(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.quality.dashboard({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      from: dateOrThrow(from, 'from'),
      to: dateOrThrow(to, 'to'),
    });
  }
}
