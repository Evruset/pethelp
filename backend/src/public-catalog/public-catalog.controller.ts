import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PublicAvailabilityResponse,
  PublicCatalogResponse,
  PublicClinicDetail,
  PublicClinicsResponse,
  PublicCatalogFilters,
  PublicCatalogService,
  PublicLocationServicesResponse,
  PublicDoctorsResponse,
  PublicDoctorSummary,
} from './public-catalog.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OptionalCurrentUser } from '../auth/optional-current-user.decorator';
import { JwtPayload, Role } from '../auth/auth.types';
import { OwnerPetService } from '../auth/owner-pet.service';

const defaultLimit = 20;
const maxLimit = 50;

@ApiTags('Public catalog')
@Controller('v1/catalog')
export class PublicCatalogController {
  constructor(private readonly publicCatalog: PublicCatalogService) {}

  @Get('clinic-locations')
  @ApiOperation({
    summary: 'Публичный каталог активных локаций клиник',
    description: 'Доступность возвращается только как read-only snapshot. Для бронирования клиент обязан выбрать слот и создать server-authoritative hold.',
  })
  @ApiOkResponse({ description: 'Активные локации и snapshot доступности.' })
  @ApiBadRequestResponse({ description: 'Некорректный limit или слишком длинный поисковый запрос.' })
  async listClinicLocations(
    @Query('q') query?: string,
    @Query('limit') rawLimit?: string,
  ): Promise<PublicCatalogResponse> {
    const normalizedQuery = query?.trim();
    if (normalizedQuery && normalizedQuery.length > 100) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_QUERY', message: 'q must not exceed 100 characters.' });
    }

    const limit = this.parseLimit(rawLimit);
    return this.publicCatalog.listClinicLocations({ query: normalizedQuery, limit });
  }

  private parseLimit(rawLimit?: string): number {
    if (rawLimit === undefined) return defaultLimit;
    if (!/^\d+$/.test(rawLimit)) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_LIMIT', message: `limit must be an integer from 1 to ${maxLimit}.` });
    }

    const limit = Number.parseInt(rawLimit, 10);
    if (limit < 1 || limit > maxLimit) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_LIMIT', message: `limit must be an integer from 1 to ${maxLimit}.` });
    }
    return limit;
  }
}

@ApiTags('Public catalog')
@Controller('v1')
@UseGuards(OptionalJwtAuthGuard)
export class PublicClinicController {
  constructor(
    private readonly publicCatalog: PublicCatalogService,
    private readonly ownerPets: OwnerPetService,
  ) {}

  @Get('clinics')
  @ApiOperation({ summary: 'Публичный список клиник' })
  @ApiOkResponse({ description: 'Активные клиники без внутренних MIS/provider полей.' })
  async listClinics(
    @Query('q') query?: string,
    @Query('serviceCode') serviceCode?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('availableFrom') availableFrom?: string,
    @Query('availableTo') availableTo?: string,
    @Query('openNow') openNow?: string,
    @Query('telemedAvailable') telemedAvailable?: string,
    @Query('emergencyCapability') emergencyCapability?: string,
    @Query('sort') sort?: string,
    @Query('limit') rawLimit?: string,
    @Query('selectedPetId') selectedPetId?: string,
    @OptionalCurrentUser() actor?: JwtPayload,
  ): Promise<PublicClinicsResponse> {
    const petContextApplied = await this.petContextApplied(actor, selectedPetId);
    const filters = this.filters({
      query,
      serviceCode,
      latitude,
      longitude,
      radiusKm,
      availableFrom,
      availableTo,
      openNow,
      telemedAvailable,
      emergencyCapability,
      sort,
      limit: rawLimit,
    });
    filters.petContextApplied = petContextApplied;
    return this.publicCatalog.listClinics(filters);
  }

  @Get('clinics/:clinicId')
  @ApiOperation({ summary: 'Публичная карточка клиники' })
  async readClinic(
    @Param('clinicId', new ParseUUIDPipe()) clinicId: string,
  ): Promise<PublicClinicDetail> {
    const clinic = await this.publicCatalog.readClinic(clinicId);
    if (!clinic) throw new NotFoundException({ code: 'PUBLIC_CLINIC_NOT_FOUND', message: 'Clinic was not found.' });
    return clinic;
  }

  @Get('clinics/:clinicId/doctors')
  @ApiOperation({ summary: 'Публичные активные ветеринары клиники' })
  async listDoctors(
    @Param('clinicId', new ParseUUIDPipe()) clinicId: string,
    @Query('locationId') locationId?: string,
    @Query('serviceCode') serviceCode?: string,
    @Query('limit') rawLimit?: string,
    @Query('selectedPetId') selectedPetId?: string,
    @OptionalCurrentUser() actor?: JwtPayload,
  ): Promise<PublicDoctorsResponse> {
    return this.publicCatalog.listDoctors({
      clinicId,
      locationId: this.optionalUuid(locationId, 'locationId'),
      serviceCode: this.serviceCode(serviceCode),
      limit: this.limit(rawLimit),
      petContextApplied: await this.petContextApplied(actor, selectedPetId),
    });
  }

  @Get('doctors/:doctorId')
  @ApiOperation({ summary: 'Публичный профиль активного ветеринара' })
  async readDoctor(
    @Param('doctorId', new ParseUUIDPipe()) doctorId: string,
  ): Promise<PublicDoctorSummary> {
    const doctor = await this.publicCatalog.readDoctor(doctorId);
    if (!doctor) throw new NotFoundException({ code: 'PUBLIC_DOCTOR_NOT_FOUND', message: 'Doctor was not found.' });
    return doctor;
  }

  @Get('clinics/:clinicId/locations')
  @ApiOperation({ summary: 'Активные публичные локации клиники' })
  async listClinicLocations(@Param('clinicId', new ParseUUIDPipe()) clinicId: string): Promise<PublicCatalogResponse> {
    return this.publicCatalog.listClinicLocations({ clinicId, limit: maxLimit });
  }

  @Get('clinic-locations/:locationId/services')
  @ApiOperation({ summary: 'Публичные услуги локации' })
  async listLocationServices(@Param('locationId', new ParseUUIDPipe()) locationId: string): Promise<PublicLocationServicesResponse> {
    return this.publicCatalog.listLocationServices(locationId);
  }

  @Get('clinic-locations/:locationId/availability')
  @ApiOperation({ summary: 'Публичный snapshot доступных окон локации' })
  async readAvailability(
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Query('from') rawFrom?: string,
    @Query('to') rawTo?: string,
    @Query('limit') rawLimit?: string,
  ): Promise<PublicAvailabilityResponse> {
    const from = this.date(rawFrom, new Date());
    const to = this.date(rawTo, new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000));
    if (to <= from) throw new BadRequestException({ code: 'INVALID_AVAILABILITY_RANGE', message: 'to must be greater than from.' });
    return this.publicCatalog.readLocationAvailability({ locationId, from, to, limit: this.limit(rawLimit) });
  }

  private query(value?: string): string | undefined {
    const normalized = value?.trim();
    if (normalized && normalized.length > 100) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_QUERY', message: 'q must not exceed 100 characters.' });
    }
    return normalized || undefined;
  }

  private filters(input: {
    query?: string;
    serviceCode?: string;
    latitude?: string;
    longitude?: string;
    radiusKm?: string;
    availableFrom?: string;
    availableTo?: string;
    openNow?: string;
    telemedAvailable?: string;
    emergencyCapability?: string;
    sort?: string;
    limit?: string;
  }): PublicCatalogFilters {
    const availableFrom = this.optionalDate(input.availableFrom, 'availableFrom');
    const availableTo = this.optionalDate(input.availableTo, 'availableTo');
    const latitude = this.coordinate(input.latitude, 'latitude', -90, 90);
    const longitude = this.coordinate(input.longitude, 'longitude', -180, 180);
    const radiusKm = this.radius(input.radiusKm);
    if (availableFrom && availableTo && availableTo <= availableFrom) {
      throw new BadRequestException({ code: 'INVALID_AVAILABILITY_RANGE', message: 'availableTo must be greater than availableFrom.' });
    }
    if ((latitude === undefined) !== (longitude === undefined) || (radiusKm !== undefined && (latitude === undefined || longitude === undefined))) {
      throw new BadRequestException({ code: 'INVALID_GEO_FILTER', message: 'latitude and longitude are required together; radiusKm requires both.' });
    }
    return {
      query: this.query(input.query),
      serviceCode: this.serviceCode(input.serviceCode),
      latitude,
      longitude,
      radiusKm,
      availableFrom,
      availableTo,
      openNow: this.boolean(input.openNow, 'openNow'),
      telemedAvailable: this.boolean(input.telemedAvailable, 'telemedAvailable'),
      emergencyCapability: this.capabilityCode(input.emergencyCapability),
      sort: this.sort(input.sort),
      limit: this.limit(input.limit),
    };
  }

  private serviceCode(value?: string): string | undefined {
    return this.catalogCode(value, 'INVALID_SERVICE_CODE', 'serviceCode');
  }

  private capabilityCode(value?: string): string | undefined {
    return this.catalogCode(value, 'INVALID_EMERGENCY_CAPABILITY', 'emergencyCapability');
  }

  private catalogCode(value: string | undefined, code: string, field: string): string | undefined {
    const normalized = value?.trim().toUpperCase();
    if (!normalized) return undefined;
    if (!/^[A-Z0-9_-]{1,64}$/.test(normalized)) {
      throw new BadRequestException({ code, message: `${field} must be 1-64 uppercase letters, numbers, underscores or dashes.` });
    }
    return normalized;
  }

  private coordinate(value: string | undefined, field: string, min: number, max: number): number | undefined {
    if (value === undefined || value.trim() === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException({ code: 'INVALID_GEO_FILTER', message: `${field} must be between ${min} and ${max}.` });
    }
    return parsed;
  }

  private radius(value: string | undefined): number | undefined {
    if (value === undefined || value.trim() === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) {
      throw new BadRequestException({ code: 'INVALID_GEO_FILTER', message: 'radiusKm must be greater than 0 and no more than 200.' });
    }
    return parsed;
  }

  private sort(value?: string): 'soonest' | 'name' | 'distance' | undefined {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    if (normalized !== 'soonest' && normalized !== 'name' && normalized !== 'distance') {
      throw new BadRequestException({ code: 'INVALID_CATALOG_SORT', message: 'sort must be soonest, name or distance.' });
    }
    return normalized;
  }

  private boolean(value: string | undefined, field: string): boolean | undefined {
    if (value === undefined || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new BadRequestException({ code: 'INVALID_BOOLEAN_FILTER', message: `${field} must be true or false.` });
  }

  private optionalDate(raw: string | undefined, field: string): Date | undefined {
    if (!raw) return undefined;
    const value = new Date(raw);
    if (!Number.isFinite(value.getTime())) {
      throw new BadRequestException({ code: 'INVALID_AVAILABILITY_DATE', message: `${field} must be an ISO date.` });
    }
    return value;
  }

  private limit(rawLimit?: string): number {
    if (rawLimit === undefined) return defaultLimit;
    if (!/^\d+$/.test(rawLimit)) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_LIMIT', message: `limit must be an integer from 1 to ${maxLimit}.` });
    }
    const limit = Number.parseInt(rawLimit, 10);
    if (limit < 1 || limit > maxLimit) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_LIMIT', message: `limit must be an integer from 1 to ${maxLimit}.` });
    }
    return limit;
  }

  private date(raw: string | undefined, fallback: Date): Date {
    if (!raw) return fallback;
    const value = new Date(raw);
    if (!Number.isFinite(value.getTime())) {
      throw new BadRequestException({ code: 'INVALID_AVAILABILITY_DATE', message: 'from/to must be ISO dates.' });
    }
    return value;
  }

  private optionalUuid(value: string | undefined, field: string): string | undefined {
    if (!value) return undefined;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException({ code: 'INVALID_CATALOG_UUID', message: `${field} must be a UUID.` });
    }
    return value;
  }

  private async petContextApplied(actor: JwtPayload | undefined, selectedPetId: string | undefined): Promise<boolean> {
    const petId = this.optionalUuid(selectedPetId, 'selectedPetId');
    if (!petId || !actor?.roles.includes(Role.OWNER)) return false;
    return Boolean(await this.ownerPets.readActiveCatalogContext(actor, petId));
  }
}
