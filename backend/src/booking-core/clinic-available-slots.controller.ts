import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicAvailableSlotsService } from './clinic-available-slots.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

function optionalId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return idOrThrow(value);
}

function limit(value: string | undefined): number {
  const parsed = Number(value ?? '50');
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicAvailableSlotsController {
  constructor(private readonly slots: ClinicAvailableSlotsService) {}

  @Get('clinic/:clinicId/locations/:locationId/available-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Available slots for a scoped Level-C alternative proposal' })
  @ApiOkResponse({ description: 'Only the scoped clinic location slots that can be held now.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Clinic or location are outside active employee scope.' })
  async list(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('excludeSlotId') excludeSlotId: string | undefined,
    @Query('limit') pageSize: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.slots.list({
      clinicId: idOrThrow(clinicId),
      locationId: idOrThrow(locationId),
      employee,
      excludedSlotId: optionalId(excludeSlotId),
      limit: limit(pageSize),
    });
  }
}
