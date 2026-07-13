import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiExtension, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { Capability } from '../auth/capability';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { AlternativeSlotService } from './alternative-slot.service';
import { ClinicPortalService } from './clinic-portal.service';
import { OwnerAlternativeAcceptanceService } from './owner-alternative-acceptance.service';
import { ProposeAlternativeSlotDto } from './dto/propose-alternative-slot.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function holdIdOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.holdNotFound();
  return value;
}

function requiredUuid(value: string | undefined, field: string): string {
  if (!value || !UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
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

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicPortalController {
  constructor(
    private readonly alternatives: AlternativeSlotService,
    private readonly ownerAcceptance: OwnerAlternativeAcceptanceService,
    private readonly clinicPortal: ClinicPortalService,
  ) {}

  @Post('clinic/booking-holds/:holdId/alternative-slot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Клиника предлагает владельцу альтернативный слот без освобождения исходного hold' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiCreatedResponse({ description: 'Альтернативный слот удержан на 15 минут; исходный слот остаётся удержанным.' })
  @ApiUnauthorizedResponse({ description: 'Требуется JWT сотрудника клиники.' })
  @ApiConflictResponse({ description: 'SLOT_ALREADY_TAKEN или SLOT_LOCKED_RETRY.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.' })
  async proposeAlternativeSlot(
    @Param('holdId') holdId: string,
    @Body() dto: ProposeAlternativeSlotDto,
    @CurrentUser() employee: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.alternatives.proposeAlternativeSlot(holdIdOrThrow(holdId), dto.newSlotId, employee, {
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
    });
  }

  @Post('booking-holds/:holdId/alternative-slot/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Владелец принимает альтернативный слот и переводит hold в ожидание оплаты' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '1' } })
  @ApiOkResponse({ description: 'Исходный слот освобождён, альтернативный slot удерживается до оплаты. Повторный accept возвращает итоговый результат.' })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY или SLOT_ALREADY_TAKEN.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.' })
  async acceptAlternativeSlot(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.ownerAcceptance.accept(holdIdOrThrow(holdId), owner.sub, {
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      expectedVersion: requiredVersion(ifMatch, 'If-Match'),
    });
  }

  @Post('clinic/booking-holds/:holdId/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_VETERINARIAN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Закрытие приёма врачом с публикацией заключения владельцу' })
  @ApiExtension('x-required-capabilities', [Capability.CLINICAL_VISIT_COMPLETE])
  @ApiHeader({ name: 'X-Correlation-ID', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Приём закрыт, заключение сохранено, push-событие поставлено в outbox.' })
  @ApiForbiddenResponse({ description: 'Требуются capability clinical.visit.complete и активная membership врача в локации.' })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY.' })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_STATE_TRANSITION или невалидное заключение.' })
  async completeAppointment(
    @Param('holdId') holdId: string,
    @Body() dto: { summary?: string },
    @CurrentUser() employee: JwtPayload,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.clinicPortal.completeAppointment({
      holdId: holdIdOrThrow(holdId),
      summary: dto.summary ?? '',
      employee,
      correlationId: requiredUuid(correlationId, 'X-Correlation-ID'),
    });
  }
}
