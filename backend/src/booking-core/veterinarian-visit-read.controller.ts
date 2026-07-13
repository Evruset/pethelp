import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.types';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { VeterinarianVisitReadService } from './veterinarian-visit-read.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.clinicScopeMismatch();
  return value;
}

@ApiTags('Veterinarian Visit Workspace')
@Controller('v1')
export class VeterinarianVisitReadController {
  constructor(private readonly visits: VeterinarianVisitReadService) {}

  @Get('clinic/:clinicId/locations/:locationId/vet/visits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Minimal veterinarian in-person visit workspace list' })
  @ApiExtension('x-required-capabilities', [Capability.CLINICAL_VISIT_WORKSPACE_READ])
  @ApiOkResponse({ description: 'Confirmed and completed visits for the scoped clinic location only.' })
  @ApiForbiddenResponse({ description: 'Normalized authorization denial.' })
  async list(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.visits.list(idOrThrow(clinicId), idOrThrow(locationId), employee);
  }

  @Get('clinic/:clinicId/locations/:locationId/vet/visits/:holdId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Minimal veterinarian in-person visit workspace detail' })
  @ApiExtension('x-required-capabilities', [Capability.CLINICAL_VISIT_WORKSPACE_READ])
  @ApiOkResponse({ description: 'A confirmed or completed visit in the scoped clinic location.' })
  @ApiForbiddenResponse({ description: 'Normalized authorization or resource denial.' })
  async detail(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.visits.detail(idOrThrow(clinicId), idOrThrow(locationId), idOrThrow(holdId), employee);
  }
}
