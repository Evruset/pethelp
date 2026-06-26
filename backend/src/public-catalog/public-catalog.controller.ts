import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PublicAvailabilityResponse,
  PublicCatalogResponse,
  PublicClinicDetail,
  PublicClinicsResponse,
  PublicCatalogFilters,
  PublicCatalogService,
  PublicLocationServicesResponse,
} from './public-catalog.service';

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
export class PublicClinicController {
  constructor(private readonly publicCatalog: PublicCatalogService) {}

  @Get('clinics')
  @ApiOperation({ summary: 'Публичный список клиник' })
  @ApiOkResponse({ description: 'Активные клиники без внутренних MIS/provider полей.' })
  async listClinics(
    @Query('q') query?: string,
    @Query('serviceCode') serviceCode?: string,
    @Query('availableFrom') availableFrom?: string,
    @Query('availableTo') availableTo?: string,
    @Query('openNow') openNow?: string,
    @Query('sort') sort?: string,
    @Query('limit') rawLimit?: string,
  ): Promise<PublicClinicsResponse> {
    const filters = this.filters({
      query,
      serviceCode,
      availableFrom,
      availableTo,
      openNow,
      sort,
      limit: rawLimit,
    });
    return this.publicCatalog.listClinics(filters);
  }

  @Get('clinics/:clinicId')
  @ApiOperation({ summary: 'Публичная карточка клиники' })
  async readClinic(@Param('clinicId', new ParseUUIDPipe()) clinicId: string): Promise<PublicClinicDetail> {
    const clinic = await this.publicCatalog.readClinic(clinicId);
    if (!clinic) throw new NotFoundException({ code: 'PUBLIC_CLINIC_NOT_FOUND', message: 'Clinic was not found.' });
    return clinic;
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
    availableFrom?: string;
    availableTo?: string;
    openNow?: string;
    sort?: string;
    limit?: string;
  }): PublicCatalogFilters {
    const availableFrom = this.optionalDate(input.availableFrom, 'availableFrom');
    const availableTo = this.optionalDate(input.availableTo, 'availableTo');
    if (availableFrom && availableTo && availableTo <= availableFrom) {
      throw new BadRequestException({ code: 'INVALID_AVAILABILITY_RANGE', message: 'availableTo must be greater than availableFrom.' });
    }
    return {
      query: this.query(input.query),
      serviceCode: this.serviceCode(input.serviceCode),
      availableFrom,
      availableTo,
      openNow: this.boolean(input.openNow, 'openNow'),
      sort: this.sort(input.sort),
      limit: this.limit(input.limit),
    };
  }

  private serviceCode(value?: string): string | undefined {
    const normalized = value?.trim().toUpperCase();
    if (!normalized) return undefined;
    if (!/^[A-Z0-9_-]{1,64}$/.test(normalized)) {
      throw new BadRequestException({ code: 'INVALID_SERVICE_CODE', message: 'serviceCode must be 1-64 uppercase letters, numbers, underscores or dashes.' });
    }
    return normalized;
  }

  private sort(value?: string): 'soonest' | 'name' | undefined {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    if (normalized !== 'soonest' && normalized !== 'name') {
      throw new BadRequestException({ code: 'INVALID_CATALOG_SORT', message: 'sort must be soonest or name.' });
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
}
