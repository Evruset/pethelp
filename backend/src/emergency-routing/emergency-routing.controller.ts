import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { SearchEmergencyClinicsDto } from './dto/search-emergency-clinics.dto';
import { UpsertEmergencyProfileDto } from './dto/upsert-emergency-profile.dto';
import { EmergencyProfileService } from './emergency-profile.service';
import { EmergencyRoutingService } from './emergency-routing.service';

@ApiTags('Emergency Routing')
@Controller('v1')
export class EmergencyRoutingController {
  constructor(
    private readonly routing: EmergencyRoutingService,
    private readonly profiles: EmergencyProfileService,
  ) {}

  @Get('emergency/clinics')
  @ApiOperation({ summary: 'Return verified clinics that are accepting emergency cases now' })
  @ApiOkResponse({ description: 'Only verified, fresh and accepting emergency capability profiles are returned.' })
  @ApiBadRequestResponse({ description: 'Unsupported species, malformed capability code or invalid coordinates.' })
  async search(@Query() query: SearchEmergencyClinicsDto) {
    return this.routing.search(query);
  }

  @Put('clinic/locations/:locationId/emergency-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Configure a verified emergency capability profile for a clinic location' })
  @ApiOkResponse({ description: 'Profile was stored; only VERIFIED + ACCEPTING_NOW profiles become publicly routable.' })
  async upsert(
    @Param('locationId') locationId: string,
    @Body() dto: UpsertEmergencyProfileDto,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.profiles.upsert(locationId, dto, employee);
  }
}
