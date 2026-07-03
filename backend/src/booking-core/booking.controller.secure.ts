import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { BookingHoldCreationService } from './booking-hold-creation.service';
import { BookingHoldReadService } from './booking-hold-read.service';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import {
  ApiErrorDto,
  ConfirmHoldDto,
  HoldDto,
  ReleaseHoldDto,
} from './dto/booking-openapi.dto';
import { CreateHoldDto } from './dto/create-hold.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string): value is string => Boolean(value && UUID.test(value));

function requiredUuid(value: string | undefined, field: string): string {
  if (!isUuid(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
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
@Controller('v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly holdCreationService: BookingHoldCreationService,
    private readonly holdReadService: BookingHoldReadService,
    private readonly bookingSecurityService: BookingSecurityService,
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
    summary: 'Мгновенная запись владельца на выбранный слот',
    description: 'ownerId извлекается только из Bearer JWT. Питомец проверяется внутри транзакции: чужой или отсутствующий petId не раскрывается владельцу. Для owner catalog booking non-MIS слот атомарно переводится в CONFIRMED appointment.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Уникальный ключ команды. Повтор с тем же ключом возвращает исходный результат.',
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: 'Обязательный идентификатор распределённой трассировки команды.',
  })
  @ApiCreatedResponse({ description: 'Запись создана. Для non-MIS слота ответ содержит CONFIRMED и appointmentId.', type: HoldDto })
  @ApiBadRequestResponse({ description: 'Некорректный UUID или отсутствует Idempotency-Key/X-Correlation-ID.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT отсутствует, истёк или невалиден.', type: ApiErrorDto })
  @ApiConflictResponse({
    description: 'SLOT_LOCKED_RETRY или SLOT_ALREADY_TAKEN. Для SLOT_LOCKED_RETRY сервер добавляет Retry-After: 1.',
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
  async createHold(
    @Body() dto: CreateHoldDto,
    @CurrentUser() owner: JwtPayload,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.holdCreationService.createLocalHold({
      slotId: requiredUuid(dto.slotId, 'slotId'),
      petId: requiredUuid(dto.petId, 'petId'),
      ownerId: owner.sub,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: requiredUuid(originalHeader(request, 'X-Correlation-ID'), 'X-Correlation-ID'),
    });
  }

  @Get('booking-holds/:holdId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN, Role.SYSTEM_WORKER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Получение текущего статуса hold авторизованным участником' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'HOLD_NOT_FOUND.', type: ApiErrorDto })
  @ApiForbiddenResponse({ description: 'HOLD_OWNER_MISMATCH или CLINIC_SCOPE_MISMATCH.', type: ApiErrorDto })
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
  ) {
    return this.bookingSecurityService.releaseHold({
      holdId: requiredUuid(holdId, 'holdId'),
      actor,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
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
    description: 'Доступно только CLINIC_RECEPTIONIST и CLINIC_ADMIN. Scope проверяется по JWT и employee_location_memberships внутри транзакции.',
  })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Hold подтверждён, appointment создан.', type: ConfirmHoldDto })
  @ApiBadRequestResponse({ description: 'Некорректный UUID или отсутствует Idempotency-Key.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT отсутствует, истёк или невалиден.', type: ApiErrorDto })
  @ApiForbiddenResponse({
    description: 'CLINIC_SCOPE_MISMATCH — сотрудник не имеет активного доступа к локации слота.',
    type: ApiErrorDto,
  })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.', type: ApiErrorDto })
  async confirmManualHold(
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.bookingSecurityService.confirmManualHold({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
    });
  }

  @Post('clinic/booking-holds/:holdId/decline')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Отклонение заявки сотрудником клиники',
    description: 'Команда освобождает hold и слот только после backend ABAC, FIFO и If-Match проверки.',
  })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Correlation-ID', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Hold отклонён клиникой и освобождён.', type: ReleaseHoldDto })
  @ApiForbiddenResponse({ description: 'CLINIC_SCOPE_MISMATCH.', type: ApiErrorDto })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY или QUEUE_FIFO_VIOLATION.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.', type: ApiErrorDto })
  async declineManualHold(
    @Param('holdId') holdId: string,
    @CurrentUser() employee: JwtPayload,
    @Body() body: { declineReason?: unknown } | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const declineReason = typeof body?.declineReason === 'string' ? body.declineReason.slice(0, 500) : undefined;
    return this.bookingSecurityService.declineManualHold({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      declineReason,
    });
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
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
      noteRequest,
    });
  }
}
