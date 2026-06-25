import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicCatalogResponse, PublicCatalogService } from './public-catalog.service';

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
