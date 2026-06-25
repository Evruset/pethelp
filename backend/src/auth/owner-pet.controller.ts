import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { CreateOwnerPetDto } from './dto/owner-pet.dto';
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

  @Post()
  @ApiOperation({ summary: 'Создание питомца для текущего владельца' })
  @ApiCreatedResponse({ description: 'Питомец создан и принадлежит владельцу из JWT.' })
  async create(@CurrentUser() owner: JwtPayload, @Body() dto: CreateOwnerPetDto) {
    return this.pets.create(owner, dto);
  }
}
