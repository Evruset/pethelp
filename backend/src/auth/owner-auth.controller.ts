import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { RefreshOwnerSessionDto, RequestOwnerOtpDto, RevokeOwnerSessionDto, VerifyOwnerOtpDto } from './dto/owner-auth.dto';
import { OwnerAppointmentsService } from './owner-appointments.service';
import { OwnerAuthService } from './owner-auth.service';

@ApiTags('Owner authentication')
@Controller('v1/auth')
export class OwnerAuthController {
  constructor(private readonly ownerAuth: OwnerAuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Запрос одноразового кода для входа владельца' })
  async requestOtp(@Body() dto: RequestOwnerOtpDto) {
    return this.ownerAuth.requestOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверка одноразового кода и создание owner session' })
  async verifyOtp(@Body() dto: VerifyOwnerOtpDto) {
    return this.ownerAuth.verifyOtp(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ротация refresh token владельца' })
  async refresh(@Body() dto: RefreshOwnerSessionDto) {
    return this.ownerAuth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отзыв owner session по refresh token' })
  async logout(@Body() dto: RevokeOwnerSessionDto): Promise<void> {
    await this.ownerAuth.revoke(dto);
  }
}

@ApiTags('Owner profile')
@Controller('v1/owner')
export class OwnerProfileController {
  constructor(
    private readonly ownerAuth: OwnerAuthService,
    private readonly appointments: OwnerAppointmentsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Профиль текущего владельца' })
  @ApiOkResponse({ description: 'Идентификатор, телефон и число питомцев.' })
  @ApiUnauthorizedResponse({ description: 'Bearer token отсутствует или невалиден.' })
  async profile(@CurrentUser() owner: JwtPayload) {
    return this.ownerAuth.profile(owner);
  }

  @Get('appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Список заявок и записей текущего владельца' })
  @ApiOkResponse({ description: 'Только заявки и записи владельца из bearer JWT.' })
  async listAppointments(@CurrentUser() owner: JwtPayload) {
    return this.appointments.list(owner);
  }
}
