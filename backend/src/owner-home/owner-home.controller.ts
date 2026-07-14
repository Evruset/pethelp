import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtPayload, Role } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OwnerHomeService } from './owner-home.service';

@ApiTags('Owner home')
@Controller('v1/owner/home')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@ApiBearerAuth('bearer')
export class OwnerHomeController {
  constructor(private readonly home: OwnerHomeService) {}

  @Get()
  @ApiOperation({ summary: 'Owner-scoped home read model and next safe action' })
  @ApiQuery({ name: 'selectedPetId', required: false, format: 'uuid' })
  @ApiOkResponse({ description: 'Minimal owned pet projections and one server-prioritized safe action.' })
  @ApiBadRequestResponse({ description: 'selectedPetId is present but is not a UUID.' })
  async read(@CurrentUser() owner: JwtPayload, @Query('selectedPetId') selectedPetId?: string) {
    return this.home.read(owner, selectedPetId);
  }
}
