import { Controller, Get, Header, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { isClinicPatientsRegistryEnabled } from '../config';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicPatientDetailService } from './clinic-patient-detail.service';
import { ClinicPatientDetailDto } from './dto/clinic-patient-detail.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const notFound = (): never => { throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' }); };
const scopedId = (value: string): string => UUID.test(value) ? value : notFound();

@ApiTags('Clinic Patients')
@Controller('v1')
export class ClinicPatientDetailController {
  constructor(private readonly detailService: ClinicPatientDetailService) {}

  @Get('clinic/:clinicId/locations/:locationId/patients/:patientId')
  @Header('Cache-Control', 'no-store, private')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiExtension('x-required-capabilities', [Capability.PATIENT_ADMIN_READ])
  @ApiOperation({
    summary: 'Current administrative patient detail for an exact clinic location',
    description: 'Default-off rollout. Returns no clinical, owner-contact, document or financial fields.',
  })
  @ApiParam({ name: 'clinicId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'locationId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'patientId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ClinicPatientDetailDto })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Administrative capability and exact active membership are required.' })
  @ApiNotFoundResponse({ description: 'Rollout disabled or patient is not currently visible in the exact scope.' })
  @ApiResponse({ status: 500, description: 'Controlled technical or malformed-source failure.' })
  @ApiResponse({ status: 503, description: 'Visibility policy configuration is unavailable.' })
  detail(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('patientId') patientId: string,
    @CurrentUser() employee: JwtPayload,
  ): Promise<ClinicPatientDetailDto> {
    if (!isClinicPatientsRegistryEnabled()) return notFound();
    return this.detailService.detail({
      clinicId: scopedId(clinicId),
      locationId: scopedId(locationId),
      patientId: scopedId(patientId),
      employee,
    });
  }
}
