import { Body, Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { CreateOwnerPetDto, UpdateOwnerPetDto } from './dto/owner-pet.dto';
import { OwnerPetService } from './owner-pet.service';

@ApiTags('Owner pets')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/pets')
export class OwnerPetController {
  constructor(private readonly pets: OwnerPetService) {}

  @Get()
  @ApiOperation({ summary: 'Список питомцев текущего владельца' })
  @ApiOkResponse({ description: 'Питомцы доступны только владельцу из JWT.' })
  async list(@CurrentUser() owner: JwtPayload) {
    return this.pets.list(owner);
  }

  @Get(':petId/care-summary')
  @ApiOperation({ summary: 'Медицинская карта питомца: профиль, документы и история помощи' })
  @ApiOkResponse({ description: 'Owner-scoped care summary без внутренних MIS/provider данных.' })
  async careSummary(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) {
    const summary = await this.pets.careSummary(owner, petId);
    if (!summary) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    return summary;
  }

  @Get(':petId')
  @ApiOperation({ summary: 'Профиль питомца текущего владельца' })
  @ApiOkResponse({ description: 'Расширенный профиль питомца без чужих owner данных.' })
  async read(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) {
    const pet = await this.pets.read(owner, petId);
    if (!pet) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    return pet;
  }

  @Post()
  @ApiOperation({ summary: 'Создание питомца для текущего владельца' })
  @ApiCreatedResponse({ description: 'Питомец создан и принадлежит владельцу из JWT.' })
  async create(@CurrentUser() owner: JwtPayload, @Body() dto: CreateOwnerPetDto) {
    return this.pets.create(owner, dto);
  }

  @Patch(':petId')
  @ApiOperation({ summary: 'Обновление профиля питомца текущего владельца' })
  @ApiOkResponse({ description: 'Профиль обновлён, profileVersion увеличен.' })
  async update(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Body() dto: UpdateOwnerPetDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.pets.update(owner, petId, dto, this.parseIfMatch(ifMatch));
  }

  private parseIfMatch(value?: string): number | undefined {
    if (!value) return undefined;
    const normalized = value.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
    if (!/^\d+$/.test(normalized)) return undefined;
    return Number.parseInt(normalized, 10);
  }
}
