import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiErrorDto } from '../booking-core/dto/booking-openapi.dto';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { OwnerAvailabilityDto, OwnerClinicCatalogDto, OwnerClinicServiceCatalogDto, OwnerSpecialistDiscoveryDto, OwnerSpecialistDiscoveryOptionsDto, OwnerSpecialistDiscoveryQueryDto } from './owner-clinic-catalog.dto';
import { PublicCatalogService } from './public-catalog.service';

@ApiTags('Owner clinic catalog')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/clinic-catalog')
export class OwnerClinicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get()
  @ApiOkResponse({ type: OwnerClinicCatalogDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async list(): Promise<OwnerClinicCatalogDto> {
    const result = await this.catalog.listClinicLocations({ limit: 50, openNow: true });
    return {
      observedAt: result.observedAt,
      clinics: result.locations.map(({ clinic, location }) => ({
        clinicId: clinic.id,
        locationId: location.id,
        name: clinic.name,
        address: location.address,
        phone: location.phone,
      })),
    };
  }

  @Get('specialist-discovery/options')
  @ApiOkResponse({ type: OwnerSpecialistDiscoveryOptionsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async specialistDiscoveryOptions(): Promise<OwnerSpecialistDiscoveryOptionsDto> {
    return this.catalog.readOwnerSpecialistDiscoveryOptions();
  }

  @Get('specialist-discovery')
  @ApiOkResponse({ type: OwnerSpecialistDiscoveryDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async specialistDiscovery(@Query() query: OwnerSpecialistDiscoveryQueryDto): Promise<OwnerSpecialistDiscoveryDto> {
    const serviceCode = query.serviceCode?.trim().toUpperCase();
    if (!query.specialtyId && !serviceCode) {
      throw new BadRequestException({ code: 'SPECIALIST_DISCOVERY_SELECTOR_REQUIRED', message: 'specialtyId or serviceCode is required' });
    }
    return this.catalog.readOwnerSpecialistDiscovery({ specialtyId: query.specialtyId, serviceCode, limit: query.limit });
  }

  @Get(':clinicId/locations/:locationId')
  @ApiParam({ name: 'clinicId', format: 'uuid' })
  @ApiParam({ name: 'locationId', format: 'uuid' })
  @ApiOkResponse({ type: OwnerClinicServiceCatalogDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async detail(@Param('clinicId', new ParseUUIDPipe()) clinicId: string, @Param('locationId', new ParseUUIDPipe()) locationId: string): Promise<OwnerClinicServiceCatalogDto> {
    const result = await this.catalog.readOwnerClinicServices(clinicId, locationId);
    if (!result) throw new NotFoundException({ code: 'OWNER_CLINIC_LOCATION_NOT_FOUND', message: 'Clinic location not found' });
    return result;
  }

  @Get(':clinicId/locations/:locationId/services/:serviceId/availability')
  @ApiParam({ name: 'clinicId', format: 'uuid' })
  @ApiParam({ name: 'locationId', format: 'uuid' })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiOkResponse({ type: OwnerAvailabilityDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async availability(
    @Param('clinicId', new ParseUUIDPipe()) clinicId: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ): Promise<OwnerAvailabilityDto> {
    const result = await this.catalog.readOwnerAvailability(clinicId, locationId, serviceId);
    if (!result) throw new NotFoundException({ code: 'OWNER_AVAILABILITY_CONTEXT_NOT_FOUND', message: 'Availability context not found' });
    return result;
  }
}
