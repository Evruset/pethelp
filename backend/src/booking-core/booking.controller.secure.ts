import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { BookingHoldCreationService } from './booking-hold-creation.service';
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

@ApiTags('Booking Core')
@Controller('v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly holdCreationService: BookingHoldCreationService,
    private readonly bookingSecurityService: BookingSecurityService,
  ) {}

  @Get('clinic-locations/:clinicLocationId/slots')
  @ApiOperation({ summary: 'Получение доступных слотов клиники' })
  async listSlots(@Param('clinicLocationId') clinicLocationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!isUuid(clinicLocationId)) throw DomainErrors.slotNotFound();
    return this.bookingService.listSlots(clinicLocationId, from, to);
  }

  @Post('booking-holds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({
    summary: 'Создание локального удержания слота владельцем',
    description: 'ownerId извлекается только из Bearer JWT. Питомец проверяется внутри транзакции: чужой или отсутствующий petId не раскрывается владельцу.',
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
    description: 'Идентификатор распределённой трассировки. Если отсутствует, сервер генерирует UUID.',
  })
  @ApiCreatedResponse({ description: 'Hold создан и ожидает ручного подтверждения клиникой.', type: HoldDto })
  @ApiBadRequestResponse({ description: 'Некорректный UUID или отсутствует Idempotency-Key.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT отсутствует, истёк или невалиден.', type: ApiErrorDto })
  @ApiForbiddenResponse({
    description: 'PET_OWNERSHIP_MISMATCH — питомец отсутствует либо не принадлежит владельцу из JWT.',
    type: ApiErrorDto,
  })
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
  async createHold(
    @Body() dto: CreateHoldDto,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.holdCreationService.createLocalHold({
      slotId: requiredUuid(dto.slotId, 'slotId'),
      petId: requiredUuid(dto.petId, 'petId'),
      ownerId: owner.sub,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
    });
  }

  @Get('booking-holds/:holdId')
  @ApiOperation({ summary: 'Получение текущего статуса hold' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'HOLD_NOT_FOUND.', type: ApiErrorDto })
  async getHold(@Param('holdId') holdId: string) {
    if (!isUuid(holdId)) throw DomainErrors.holdNotFound();
    return this.bookingService.findHold(holdId);
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
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.bookingSecurityService.confirmManualHold({
      holdId: requiredUuid(holdId, 'holdId'),
      employee,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
    });
  }
}
