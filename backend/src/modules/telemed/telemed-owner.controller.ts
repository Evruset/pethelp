import { BadRequestException, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiConflictResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { TelemedOwnerEndService } from './telemed-owner-end.service';
import { TelemedOwnerService } from './telemed-owner.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function id(value: string, name: string): string {
  if (!UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${name} must be a UUID.` });
  return value;
}

function headerId(value: string | undefined, name: string, required = false): string {
  if (!value && !required) return randomUUID();
  if (!value || !UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${name} must be a UUID.` });
  return value;
}

@ApiTags('Telemedicine')
@Controller('v1/telemed/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
export class TelemedOwnerController {
  constructor(
    private readonly ownerSessions: TelemedOwnerService,
    private readonly ownerEnd: TelemedOwnerEndService,
  ) {}

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get owner-safe telemedicine session snapshot' })
  @ApiOkResponse({ description: 'Authoritative session state with server clock and refund process state.' })
  @ApiUnauthorizedResponse({ description: 'Owner JWT is required.' })
  async read(@Param('sessionId') sessionId: string, @CurrentUser() owner: JwtPayload) {
    return this.ownerSessions.read(id(sessionId, 'sessionId'), owner.sub);
  }

  @Post(':sessionId/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a short-lived owner LiveKit token for a connected session' })
  @ApiConflictResponse({ description: 'Session is waiting, ending, completed or otherwise not joinable.' })
  async token(@Param('sessionId') sessionId: string, @CurrentUser() owner: JwtPayload) {
    return this.ownerSessions.issueRoomToken(id(sessionId, 'sessionId'), owner.sub);
  }

  @Post(':sessionId/end')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Request room close; completion is confirmed only by LiveKit room_finished webhook' })
  @ApiOkResponse({ description: 'Close command accepted or session was already completed.' })
  @ApiConflictResponse({ description: 'Session is not currently endable.' })
  @ApiUnprocessableEntityResponse({ description: 'Session cannot be ended from the current state.' })
  async end(
    @Param('sessionId') sessionId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.ownerEnd.requestEnd({
      sessionId: id(sessionId, 'sessionId'),
      ownerId: owner.sub,
      idempotencyKey: headerId(idempotencyKey, 'Idempotency-Key', true),
      correlationId: headerId(correlationId, 'X-Correlation-ID', true),
    });
  }
}
