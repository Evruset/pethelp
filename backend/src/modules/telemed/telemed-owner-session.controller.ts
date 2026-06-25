import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { TelemedOwnerSessionService } from './telemed-owner-session.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Telemedicine')
@Controller('v1/telemed')
export class TelemedOwnerSessionController {
  constructor(private readonly sessions: TelemedOwnerSessionService) {}

  @Get('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Authoritative waiting room snapshot for the owner' })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Telemed state, serverNow, doctor join deadline and aggregate version.' })
  @ApiNotFoundResponse({ description: 'Session is absent or does not belong to the owner.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async read(@Param('sessionId') sessionId: string, @CurrentUser() owner: JwtPayload) {
    if (!UUID.test(sessionId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'sessionId must be a UUID.' });
    }
    return this.sessions.read(sessionId, owner.sub);
  }
}
