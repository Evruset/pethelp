import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
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

function holdIdOrThrow(value: string): string {
  if (!UUID.test(value)) throw DomainErrors.holdNotFound();
  return value;
}

@ApiTags('Clinic Portal')
@Controller('v1')
export class ClinicPortalController {
  constructor(private readonly alternatives: AlternativeSlotService) {}

  @Post('clinic/booking-holds/:holdId/alternative-slot')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Клиника предлагает владельцу альтернативный слот без освобождения исходного hold' })
  @ApiOkResponse({ description: 'Альтернативный слот удержан на 15 минут; исходный слот остаётся удержанным.' })
  @ApiUnauthorizedResponse({ description: 'Требуется JWT сотрудника клиники.' })
  @ApiConflictResponse({ description: 'SLOT_ALREADY_TAKEN или SLOT_LOCKED_RETRY.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.' })
  async proposeAlternativeSlot(
    @Param('holdId') holdId: string,
    @Body() dto: ProposeAlternativeSlotDto,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.alternatives.proposeAlternativeSlot(holdIdOrThrow(holdId), dto.newSlotId, employee);
  }

  @Post('booking-holds/:holdId/alternative-slot/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Владелец принимает альтернативный слот и подтверждает перенос' })
  @ApiOkResponse({ description: 'Исходный слот освобождён, альтернативный слот подтверждён.' })
  @ApiConflictResponse({ description: 'SLOT_LOCKED_RETRY или SLOT_ALREADY_TAKEN.' })
  @ApiUnprocessableEntityResponse({ description: 'HOLD_EXPIRED или INVALID_STATE_TRANSITION.' })
  async acceptAlternativeSlot(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
  ) {
    return this.alternatives.acceptAlternativeSlot(holdIdOrThrow(holdId), owner.sub);
  }
}
