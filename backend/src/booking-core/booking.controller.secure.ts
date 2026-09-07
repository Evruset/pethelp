import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { TraceContext } from '../observability/trace-context.context';
import { mvpScope } from '../config/mvp-scope.config';
import { BookingHoldCreationService } from './booking-hold-creation.service';
import { BookingHoldReadService } from './booking-hold-read.service';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import { OwnerAlternativeAcceptanceService } from './owner-alternative-acceptance.service';
import { OwnerAlternativeSnapshotService } from './owner-alternative-snapshot.service';
import {
  ApiErrorDto,
  BookingCommandStatusDto,
  BookingHoldReadDto,
  ClinicConfirmDecisionStatusDto,
  ClinicDeclineCommandDto,
  ClinicRejectDecisionStatusDto,
  HoldDto,
  ReleaseHoldDto,
} from './dto/booking-openapi.dto';
import { CLINIC_DECLINE_REASON_CODES } from './booking.types';
import { CreateHoldDto } from './dto/create-hold.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string): value is string => Boolean(value && UUID.test(value));

function requiredUuid(value: string | undefined, field: string): string {
  if (!isUuid(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

function publicCommandResult<T extends { holdId: string; slotId: string; correlationId: string; state: string; appointmentId?: string }>(
  result: T,
  status: 'CONFIRMED' | 'REJECTED' | 'CANCELLED',
): Omit<T, 'state'> & { status: typeof status } {
  const { state: _state, ...safe } = result;
  return { ...safe, status };
}

@ApiTags('Owner bookings')
@Controller('v1/owner/bookings')
export class OwnerBookingCancellationController {
  constructor(
    private readonly bookingSecurityService: BookingSecurityService,
    private readonly alternativeSnapshots: OwnerAlternativeSnapshotService,
    private readonly alternativeAcceptance: OwnerAlternativeAcceptanceService,
    private readonly traceContext: TraceContext,
  ) {}

  @Get(':bookingId/alternative')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  async alternative(@Param('bookingId') bookingId: string, @CurrentUser() owner: JwtPayload) {
    return this.alternativeSnapshots.read(requiredUuid(bookingId, 'bookingId'), owner.sub);
  }

  @Post(':bookingId/alternative/:proposalId/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  async acceptAlternative(
    @Param('proposalId') proposalId: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.alternativeAcceptance.resolve(requiredUuid(proposalId, 'proposalId'), owner.sub, 'ACCEPT', {
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: requiredUuid(correlationId, 'X-Correlation-ID'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
    }, requiredUuid(bookingId, 'bookingId'));
  }

  @Post(':bookingId/alternative/:proposalId/decline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  async declineAlternative(
    @Param('proposalId') proposalId: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.alternativeAcceptance.resolve(requiredUuid(proposalId, 'proposalId'), owner.sub, 'DECLINE', {
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: requiredUuid(correlationId, 'X-Correlation-ID'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
    }, requiredUuid(bookingId, 'bookingId'));
  }

  @Post(':holdId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', pattern: '^[1-9][0-9]*$', example: '3' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: true, description: 'Required for command tracing. Malformed or duplicate supplied values are replaced by the server trace middleware.', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({
    required: false,
    schema: mvpScope.pilot ? {
      type: 'object',
      additionalProperties: false,
      properties: { reasonCode: { type: 'string', enum: ['OWNER_PLANS_CHANGED', 'PET_RECOVERED', 'OTHER'] } },
    } : { type: 'object', properties: { reasonCode: { type: 'string' } } },
  })
  @ApiOkResponse(mvpScope.pilot ? {
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['holdId', 'slotId', 'status', 'correlationId', 'aggregateVersion', 'lastUpdatedAt', 'serverNow'],
      properties: {
        holdId: { type: 'string', format: 'uuid' },
        slotId: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['CANCELLED'] },
        correlationId: { type: 'string', format: 'uuid' },
        aggregateVersion: { type: 'integer', minimum: 1 },
        lastUpdatedAt: { type: 'string', format: 'date-time' },
        serverNow: { type: 'string', format: 'date-time' },
        appointmentId: { type: 'string', format: 'uuid' },
      },
    },
  } : { type: BookingCommandStatusDto })
  @ApiBadRequestResponse({ description: 'Malformed hold ID, headers or cancellation reason.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Owner JWT is missing or invalid.', type: ApiErrorDto })
  @ApiForbiddenResponse({ description: 'Authenticated actor is not an Owner.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'Booking is absent or belongs to another Owner.', type: ApiErrorDto })
  @ApiConflictResponse({ description: 'BOOKING_STATE_CONFLICT, IDEMPOTENCY_CONFLICT or SLOT_LOCKED_RETRY.', type: ApiErrorDto, headers: { 'Retry-After': { description: 'Retry delay for SLOT_LOCKED_RETRY.', schema: { type: 'string', example: '1' } } } })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Replica-safe Owner cancellation command limit exceeded.', type: ApiErrorDto, headers: { 'Retry-After': { schema: { type: 'string', example: '1' } } } })
  @ApiServiceUnavailableResponse({ description: 'BOOKING_TEMPORARILY_UNAVAILABLE.', type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ description: 'Controlled technical failure.', type: ApiErrorDto })
  async cancel(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Body() body?: unknown,
  ) {
    const allowedReasons = ['OWNER_PLANS_CHANGED', 'PET_RECOVERED', 'OTHER'] as const;
    if (mvpScope.pilot && body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body))) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Cancellation payload must be an object.' });
    }
    const payload = body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (mvpScope.pilot && Object.keys(payload).some((key) => key !== 'reasonCode')) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Cancellation payload contains unsupported fields.' });
    }
    if (payload.reasonCode !== undefined && (
      typeof payload.reasonCode !== 'string'
      || !allowedReasons.includes(payload.reasonCode as (typeof allowedReasons)[number])
    )) {
      throw new BadRequestException({
        code: mvpScope.pilot ? 'INVALID_REQUEST' : 'INVALID_CANCELLATION_REASON',
        message: 'Unsupported cancellation reason.',
      });
    }
    const validatedHoldId = requiredUuid(holdId, 'holdId');
    const validatedIdempotencyKey = requiredUuid(idempotencyKey, 'Idempotency-Key');
    const validatedVersion = requiredVersion(ifMatch, 'If-Match');
    if (mvpScope.pilot && originalHeader(request, 'X-Correlation-ID') === undefined) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'X-Correlation-ID is required.' });
    }
    const result = await this.bookingSecurityService.cancelOwnerBooking({
      holdId: validatedHoldId,
      owner,
      idempotencyKey: validatedIdempotencyKey,
      expectedVersion: validatedVersion,
      correlationId: mvpScope.pilot
        ? (this.traceContext.getCorrelationId() ?? randomUUID())
        : (isUuid(originalHeader(request, 'X-Correlation-ID'))
          ? originalHeader(request, 'X-Correlation-ID')!
          : (this.traceContext.getCorrelationId() ?? randomUUID())),
      reasonCode: payload.reasonCode as (typeof allowedReasons)[number] | undefined,
    });
    return mvpScope.pilot ? publicCommandResult(result, 'CANCELLED') : result;
  }

}

function requiredVersion(value: string | undefined, field: string): number {
  const normalized = value?.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  const parsed = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== normalized) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a positive aggregate version.` });
  }
  return parsed;
}

function originalHeader(request: Request, field: string): string | undefined {
  const lowerField = field.toLowerCase();
  for (let index = 0; index < request.rawHeaders.length - 1; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === lowerField) return request.rawHeaders[index + 1];
  }
  return undefined;
}

@ApiTags('Booking Core')
@ApiExtraModels(CreateHoldDto)
@Controller('v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly holdCreationService: BookingHoldCreationService,
    private readonly holdReadService: BookingHoldReadService,
    private readonly bookingSecurityService: BookingSecurityService,
    private readonly traceContext: TraceContext,
  ) {}

  @Get('clinic-locations/:clinicLocationId/slots')
  @ApiOperation({ summary: 'Получение доступных слотов клиники' })
  async listSlots(
    @Param('clinicLocationId') clinicLocationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    if (!isUuid(clinicLocationId)) throw DomainErrors.slotNotFound();
    if (serviceId !== undefined && !isUuid(serviceId)) {
      throw new BadRequestException({ code: 'INVALID_SERVICE_ID', message: 'serviceId must be a UUID.' });
    }
    return this.bookingService.listSlots(clinicLocationId, from, to, serviceId);
  }

  @Post('booking-holds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Отправить заявку владельца на выбранное время',
    description: 'Owner authority извлекается только из Bearer credential. В PILOT_V1 сервер повторно проверяет полный clinic/location/service/slot context и создаёт заявку с ручным подтверждением клиникой.',
  })
  @ApiBody({
    schema: mvpScope.pilot ? {
      type: 'object',
      additionalProperties: false,
      required: ['petId', 'clinicId', 'locationId', 'serviceId', 'slotId', 'expectedSlotVersion'],
      properties: {
        petId: { type: 'string', format: 'uuid' },
        clinicId: { type: 'string', format: 'uuid' },
        locationId: { type: 'string', format: 'uuid' },
        serviceId: { type: 'string', format: 'uuid' },
        slotId: { type: 'string', format: 'uuid' },
        expectedSlotVersion: { type: 'integer', minimum: 1 },
      },
    } : { $ref: '#/components/schemas/CreateHoldDto' },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Уникальный ключ команды. Повтор с тем же ключом возвращает исходный результат.',
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Optional valid UUID. Missing, malformed or duplicated input is replaced server-side.',
  })
  @ApiCreatedResponse({ description: 'PILOT_V1 returns the canonical status without internal state.', type: HoldDto })
  @ApiBadRequestResponse({ description: 'Malformed DTO, UUID or Idempotency-Key.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer credential отсутствует, истёк или невалиден.', type: ApiErrorDto })
  @ApiForbiddenResponse({ description: 'Authenticated actor is not an Owner.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'Slot is not found.', type: ApiErrorDto })
  @ApiConflictResponse({
    description: 'BOOKING_STATE_CONFLICT, IDEMPOTENCY_CONFLICT, SLOT_LOCKED_RETRY или SLOT_ALREADY_TAKEN. Для SLOT_LOCKED_RETRY сервер добавляет Retry-After: 1.',
    type: ApiErrorDto,
    headers: {
      'Retry-After': {
        description: 'Рекомендованная пауза перед повторной попыткой при SLOT_LOCKED_RETRY.',
        schema: { type: 'string', example: '1' },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'PET_OWNERSHIP_MISMATCH, HOLD_ALREADY_ACTIVE или SLOT_UNAVAILABLE.',
    type: ApiErrorDto,
  })
  @ApiInternalServerErrorResponse({ description: 'Controlled technical failure.', type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ description: 'BOOKING_TEMPORARILY_UNAVAILABLE.', type: ApiErrorDto })
  async createHold(
    @Body() dto: CreateHoldDto,
    @CurrentUser() owner: JwtPayload,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (mvpScope.pilot && dto.doctorId !== undefined) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Request validation failed' });
    }
    return this.holdCreationService.createLocalHold({
      slotId: requiredUuid(dto.slotId, 'slotId'),
      petId: requiredUuid(dto.petId, 'petId'),
      clinicId: dto.clinicId === undefined ? undefined : requiredUuid(dto.clinicId, 'clinicId'),
      locationId: dto.locationId === undefined ? undefined : requiredUuid(dto.locationId, 'locationId'),
      expectedSlotVersion: dto.expectedSlotVersion,
      serviceId: dto.serviceId === undefined ? undefined : requiredUuid(dto.serviceId, 'serviceId'),
      doctorId: dto.doctorId === null || dto.doctorId === undefined ? null : requiredUuid(dto.doctorId, 'doctorId'),
      ownerId: owner.sub,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: this.traceContext.getCorrelationId()
        ?? (isUuid(originalHeader(request, 'X-Correlation-ID')) ? originalHeader(request, 'X-Correlation-ID')! : randomUUID()),
    });
  }

  @Get('booking-holds/:holdId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN, Role.SYSTEM_WORKER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Получение текущего статуса hold авторизованным участником' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Canonical authoritative booking snapshot.', type: BookingHoldReadDto })
  @ApiBadRequestResponse({ description: 'holdId is not a UUID.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'HOLD_NOT_FOUND.', type: ApiErrorDto })
  @ApiForbiddenResponse({ description: 'CLINIC_SCOPE_MISMATCH для clinic actor.', type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ description: 'Controlled technical failure.', type: ApiErrorDto })
  async getHold(@Param('holdId') holdId: string, @CurrentUser() actor: JwtPayload) {
    return this.holdReadService.readForActor(requiredUuid(holdId, 'holdId'), actor);
  }

  @Post('booking-holds/:holdId/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.SYSTEM_WORKER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Освобождение hold владельцем или системным worker' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Hold освобождён.', type: ReleaseHoldDto })
  @ApiForbiddenResponse({ description: 'HOLD_OWNER_MISMATCH.', type: ApiErrorDto })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY.', type: ApiErrorDto })
  async releaseHold(
    @Param('holdId') holdId: string,
    @CurrentUser() actor: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
    @Headers('if-match') ifMatch?: string,
    @Body() body?: { reasonCode?: string },
  ) {
    return this.bookingSecurityService.releaseHold({
      holdId: requiredUuid(holdId, 'holdId'),
      actor,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: this.traceContext.getCorrelationId() ?? (isUuid(correlationHeader) ? correlationHeader : randomUUID()),
      expectedVersion: ifMatch === undefined ? undefined : requiredVersion(ifMatch, 'If-Match'),
      reasonCode: body?.reasonCode,
    });
  }

  @Post('booking-holds/:holdId/cancellation-requests')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Владелец запрашивает ручную отмену записи без автоматического освобождения брони' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({
    name: 'X-Correlation-ID',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Идентификатор трассировки заявки в поддержку.',
  })
  @ApiOkResponse({ description: 'Запрос отмены поставлен в очередь поддержки.' })
  @ApiForbiddenResponse({ description: 'HOLD_OWNER_MISMATCH.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_STATE_TRANSITION.', type: ApiErrorDto })
  async requestCancellation(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
    @Req() request: Request,
  ) {
    return this.holdCreationService.requestCancellation({
      holdId: requiredUuid(holdId, 'holdId'),
      ownerId: owner.sub,
      correlationId: requiredUuid(originalHeader(request, 'X-Correlation-ID'), 'X-Correlation-ID'),
    });
  }

  @Post('clinic/booking-holds/:holdId/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Подтверждение удержания сотрудником клиники',
    description: 'CONFIRM_BOOKING_REQUEST. Booking decision capability, exact clinic/location scope, aggregate version and PostgreSQL deadline are rechecked inside the transaction.',
  })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, description: 'Positive authoritative booking aggregate version.', schema: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Authoritative CONFIRMED result; appointment created exactly once.', type: ClinicConfirmDecisionStatusDto })
  @ApiBadRequestResponse({ description: 'Некорректный UUID или отсутствует Idempotency-Key.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT отсутствует, истёк или невалиден.', type: ApiErrorDto })
  @ApiForbiddenResponse({
    description: 'CLINIC_SCOPE_MISMATCH — сотрудник не имеет активного доступа к локации слота.',
    type: ApiErrorDto,
  })
  @ApiConflictResponse({
    description: 'BOOKING_STATE_CONFLICT, IDEMPOTENCY_CONFLICT, SLOT_LOCKED_RETRY or QUEUE_FIFO_VIOLATION.',
    type: ApiErrorDto,
    headers: { 'Retry-After': { description: 'Present as 1 second for SLOT_LOCKED_RETRY; omitted for other conflicts.', schema: { type: 'string', example: '1' } } },
  })
  @ApiNotFoundResponse({ description: 'HOLD_NOT_FOUND.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED.', type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ description: 'BOOKING_TEMPORARILY_UNAVAILABLE.', type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ description: 'Controlled technical failure.', type: ApiErrorDto })
  async confirmManualHold(
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const result = await this.bookingSecurityService.confirmManualHold({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      correlationId: this.traceContext.getCorrelationId() ?? (isUuid(correlationHeader) ? correlationHeader : randomUUID()),
    });
    return mvpScope.pilot ? publicCommandResult(result, 'CONFIRMED') : result;
  }

  @Post('clinic/booking-holds/:holdId/decline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Отклонение заявки сотрудником клиники',
    description: 'REJECT_BOOKING_REQUEST. Releases held capacity without creating an appointment after transactional capability, scope, state, deadline and version checks.',
  })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, description: 'Positive authoritative booking aggregate version.', schema: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ required: false, type: ClinicDeclineCommandDto })
  @ApiOkResponse({ description: 'Authoritative REJECTED result; no appointment created.', type: ClinicRejectDecisionStatusDto })
  @ApiBadRequestResponse({ description: 'INVALID_REQUEST: malformed hold ID/header/body or unsupported decline reason.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.', type: ApiErrorDto })
  @ApiForbiddenResponse({ description: 'CLINIC_SCOPE_MISMATCH.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'HOLD_NOT_FOUND.', type: ApiErrorDto })
  @ApiConflictResponse({
    description: 'BOOKING_STATE_CONFLICT, IDEMPOTENCY_CONFLICT, SLOT_LOCKED_RETRY or QUEUE_FIFO_VIOLATION.',
    type: ApiErrorDto,
    headers: { 'Retry-After': { description: 'Present as 1 second for SLOT_LOCKED_RETRY; omitted for other conflicts.', schema: { type: 'string', example: '1' } } },
  })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED.', type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ description: 'BOOKING_TEMPORARILY_UNAVAILABLE.', type: ApiErrorDto })
  @ApiInternalServerErrorResponse({ description: 'Controlled technical failure.', type: ApiErrorDto })
  async declineManualHold(
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
    @Body() body: { declineReason?: unknown } | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const declineReason = body?.declineReason;
    if (mvpScope.pilot && declineReason !== undefined && (
      typeof declineReason !== 'string'
      || !CLINIC_DECLINE_REASON_CODES.includes(declineReason as (typeof CLINIC_DECLINE_REASON_CODES)[number])
    )) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'declineReason must be a supported safe code.' });
    }
    const result = await this.bookingSecurityService.declineManualHold({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      correlationId: this.traceContext.getCorrelationId() ?? (isUuid(correlationHeader) ? correlationHeader : randomUUID()),
      declineReason: typeof declineReason === 'string'
        ? (mvpScope.pilot ? declineReason : declineReason.slice(0, 500))
        : undefined,
    });
    return mvpScope.pilot ? publicCommandResult(result, 'REJECTED') : result;
  }

  @Post('clinic/booking-holds/:holdId/request-notes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Запрос уточнений у владельца по заявке',
    description: 'Команда не подтверждает и не освобождает hold: она создаёт authoritative audit/outbox event и увеличивает версию hold.',
  })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Запрос уточнений зафиксирован и отправлен в outbox.' })
  @ApiForbiddenResponse({ description: 'CLINIC_SCOPE_MISMATCH.', type: ApiErrorDto })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY, SLOT_VERSION_STALE или QUEUE_FIFO_VIOLATION.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.', type: ApiErrorDto })
  async requestOwnerNotes(
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
    @Body() body: { noteRequest?: unknown } | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const noteRequest = typeof body?.noteRequest === 'string' ? body.noteRequest.trim().slice(0, 1000) : '';
    if (noteRequest.length < 3) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'noteRequest must contain at least 3 characters.' });
    }
    return this.bookingSecurityService.requestOwnerNotes({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      correlationId: this.traceContext.getCorrelationId() ?? (isUuid(correlationHeader) ? correlationHeader : randomUUID()),
      noteRequest,
    });
  }
}
