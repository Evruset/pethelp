import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { BookingEventReplayService } from './booking-event-replay.service';
import { ApiErrorDto, BookingHistoryDto } from './dto/booking-openapi.dto';

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

  @Get('booking-holds/:holdId/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Read the authoritative public booking status and append-only history' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '1 to 100 public history events; default 50.' })
  @ApiQuery({ name: 'afterOccurredAt', required: false, type: String, format: 'date-time', description: 'Server timestamp from nextCursor; must be paired with afterEventId.' })
  @ApiQuery({ name: 'afterEventId', required: false, type: String, format: 'uuid', description: 'Stable event ID from nextCursor; must be paired with afterOccurredAt.' })
  @ApiOkResponse({ type: BookingHistoryDto, description: 'Canonical current status and allowlist-only history ordered by server timestamp and event ID.' })
  @ApiBadRequestResponse({ description: 'Booking ID, limit or keyset cursor is invalid.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'Booking is absent or not visible to the authenticated Owner or Clinic actor.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.', type: ApiErrorDto })
  async getHistory(
    @Param('holdId') holdId: string,
    @Query('limit') limit: string | undefined,
    @Query('afterOccurredAt') afterOccurredAt: string | undefined,
    @Query('afterEventId') afterEventId: string | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (!UUID.test(holdId)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'holdId must be a UUID.' });
    if ((afterOccurredAt === undefined) !== (afterEventId === undefined)
      || (afterOccurredAt !== undefined && Number.isNaN(Date.parse(afterOccurredAt)))
      || (afterEventId !== undefined && !UUID.test(afterEventId))) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'History cursor is invalid.' });
    }
    return this.replay.history(holdId, actor, positiveInteger(limit, 50, 100),
      afterOccurredAt && afterEventId ? { occurredAt: afterOccurredAt, eventId: afterEventId } : undefined);
  }

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
