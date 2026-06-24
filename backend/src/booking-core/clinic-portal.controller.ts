import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { AlternativeSlotService } from './alternative-slot.service';
import { ProposeAlternativeSlotDto } from './dto/propose-alternative-slot.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidOrThrow(value: string | undefined, field: string): string {
  if (!value || !UUID.test(value)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  }
  return value;
}

function holdIdOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.holdNotFound();
  return value;
}

function correlationId(value: string | undefined): string {
  return value && UUID.test(value) ? value : randomUUID();
}

function parseVersion(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/"/g, ''));
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'If-Match must contain a positive version.' });
  }
  return parsed;
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicPortalController {
  constructor(private readonly alternatives: AlternativeSlotService) {}

  @Post('clinic/booking-holds/:holdId/alternative-slot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Create an alternative slot proposal' })
  @ApiCreatedResponse({ description: 'Both source and alternative slots remain held while the owner decides.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiConflictResponse({ description: 'SLOT_ALREADY_TAKEN, SLOT_LOCKED_RETRY or IDEMPOTENCY_IN_PROGRESS.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED or INVALID_STATE_TRANSITION.' })
  async proposeAlternativeSlot(
    @Param('holdId') holdId: string,
    @Body() dto: ProposeAlternativeSlotDto,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.alternatives.proposeAlternativeSlot(
      holdIdOrThrow(holdId),
      uuidOrThrow(dto.newSlotId, 'newSlotId'),
      employee,
      {
        idempotencyKey: uuidOrThrow(idempotencyKey, 'Idempotency-Key'),
        correlationId: correlationId(correlationHeader),
      },
    );
  }

  @Post('booking-holds/:holdId/alternative-slot/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"7"' } })
  @ApiOperation({ summary: 'Accept an alternative slot atomically' })
  @ApiOkResponse({ description: 'Level-C confirms and creates an appointment atomically; Level-A continues in the MIS/payment flow.' })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY, SLOT_ALREADY_TAKEN or SLOT_VERSION_STALE.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED or INVALID_STATE_TRANSITION.' })
  async acceptAlternativeSlot(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.alternatives.acceptAlternativeSlot(holdIdOrThrow(holdId), owner.sub, {
      idempotencyKey: uuidOrThrow(idempotencyKey, 'Idempotency-Key'),
      correlationId: uuidOrThrow(correlationHeader, 'X-Correlation-ID'),
      expectedVersion: parseVersion(ifMatch),
    });
  }

  @Post('booking-holds/:holdId/alternative-slot/decline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"7"' } })
  @ApiOperation({ summary: 'Decline an alternative slot and release both temporary holds' })
  @ApiOkResponse({ description: 'The alternative booking is closed and temporary holds are released.' })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY or SLOT_VERSION_STALE.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED or INVALID_STATE_TRANSITION.' })
  async declineAlternativeSlot(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.alternatives.declineAlternativeSlot(holdIdOrThrow(holdId), owner.sub, {
      idempotencyKey: uuidOrThrow(idempotencyKey, 'Idempotency-Key'),
      correlationId: uuidOrThrow(correlationHeader, 'X-Correlation-ID'),
      expectedVersion: parseVersion(ifMatch),
    });
  }
}
