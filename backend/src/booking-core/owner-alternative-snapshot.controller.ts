import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { OwnerAlternativeSnapshotService } from './owner-alternative-snapshot.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Booking Core')
@Controller('v1')
export class OwnerAlternativeSnapshotController {
  constructor(private readonly snapshots: OwnerAlternativeSnapshotService) {}

  @Get('booking-holds/:holdId/alternative')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Authoritative owner snapshot for an alternative slot proposal' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'No active alternative proposal belongs to the owner.' })
  @ApiUnprocessableEntityResponse({ description: 'Alternative proposal is no longer active.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async getAlternative(@Param('holdId') holdId: string, @CurrentUser() owner: JwtPayload) {
    if (!UUID.test(holdId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'holdId must be a UUID.' });
    }
    return this.snapshots.read(holdId, owner.sub);
  }
}
