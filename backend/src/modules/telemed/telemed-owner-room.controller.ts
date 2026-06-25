import { BadRequestException, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { TelemedOwnerRoomService } from './telemed-owner-room.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Telemedicine')
@Controller('v1/telemed')
export class TelemedOwnerRoomController {
  constructor(private readonly rooms: TelemedOwnerRoomService) {}

  @Post('sessions/:sessionId/room-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Issue a short-lived owner video room token after doctor connection' })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Short-lived room token is issued only for CONNECTED sessions.' })
  @ApiConflictResponse({ description: 'TELEMED_DOCTOR_NOT_CONNECTED.' })
  @ApiNotFoundResponse({ description: 'Session is absent or does not belong to the owner.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async issueToken(@Param('sessionId') sessionId: string, @CurrentUser() owner: JwtPayload) {
    if (!UUID.test(sessionId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'sessionId must be a UUID.' });
    }
    return this.rooms.createRoomAccess(sessionId, owner.sub);
  }
}
