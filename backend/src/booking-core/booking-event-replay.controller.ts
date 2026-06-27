import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { BookingEventReplayService } from './booking-event-replay.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Cursor parameters are invalid.' });
  }
  return parsed;
}

@ApiTags('Realtime Replay')
@Controller('v1')
export class BookingEventReplayController {
  constructor(private readonly replay: BookingEventReplayService) {}

  @Get('booking-holds/:holdId/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN, Role.SYSTEM_WORKER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Replay versioned booking events for one hold after reconnect' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'afterVersion', required: false, type: Number, description: 'Return events with a higher aggregate version.' })
  @ApiQuery({ name: 'afterSequence', required: false, type: Number, description: 'Return events with a higher global outbox sequence.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '1 to 100 events; default 50.' })
  @ApiOkResponse({ description: 'Authoritative replay slice ordered by global sequence; each event includes the realtime envelope.' })
  @ApiForbiddenResponse({ description: 'Owner or clinic location scope does not permit the hold.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async getReplay(
    @Param('holdId') holdId: string,
    @Query('afterVersion') afterVersion: string | undefined,
    @Query('afterSequence') afterSequence: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (!UUID.test(holdId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'holdId must be a UUID.' });
    }
    return this.replay.replay(
      holdId,
      actor,
      positiveInteger(afterVersion, 0, Number.MAX_SAFE_INTEGER),
      positiveInteger(afterSequence, 0, Number.MAX_SAFE_INTEGER),
      positiveInteger(limit, 50, 100),
    );
  }
}
