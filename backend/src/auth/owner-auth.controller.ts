import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { AuthErrorDto, OwnerOtpChallengeDto, OwnerSessionDto, RequestOwnerOtpDto, ResendOwnerOtpDto, VerifyOwnerOtpDto } from './dto/owner-auth.dto';
import { OwnerAppointmentsService } from './owner-appointments.service';
import { OwnerAuthService } from './owner-auth.service';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ownerOtpClientIp } from './owner-web-client-ip';

@ApiTags('Owner authentication')
@Controller('v1/auth')
export class OwnerAuthController {
  constructor(private readonly ownerAuth: OwnerAuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Запрос одноразового кода для входа владельца' })
  @ApiOkResponse({ type: OwnerOtpChallengeDto })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR', type: AuthErrorDto })
  @ApiResponse({ status: 429, description: 'OTP_RESEND_COOLDOWN, OTP_RATE_LIMITED or OTP_TEMPORARILY_BLOCKED', type: AuthErrorDto })
  @ApiResponse({ status: 503, description: 'OTP provider failure or fail-closed anti-fraud infrastructure failure', type: AuthErrorDto })
  @ApiResponse({ status: 500, description: 'INTERNAL_ERROR', type: AuthErrorDto })
  async requestOtp(@Body() dto: RequestOwnerOtpDto, @Req() request: Request) {
    return this.ownerAuth.requestOtp({ ...dto, clientIp: ownerOtpClientIp(request) });
  }

  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Повторная отправка с заменой предыдущего OTP material' })
  @ApiOkResponse({ type: OwnerOtpChallengeDto })
  @ApiResponse({ status: 404, description: 'OTP_CHALLENGE_NOT_FOUND', type: AuthErrorDto })
  @ApiResponse({ status: 409, description: 'OTP_ALREADY_USED', type: AuthErrorDto })
  @ApiResponse({ status: 429, description: 'OTP_RESEND_COOLDOWN, OTP_RATE_LIMITED or OTP_TEMPORARILY_BLOCKED', type: AuthErrorDto })
  @ApiResponse({ status: 503, description: 'Safe provider or fail-closed anti-fraud infrastructure failure', type: AuthErrorDto })
  @ApiResponse({ status: 500, description: 'INTERNAL_ERROR', type: AuthErrorDto })
  async resendOtp(@Body() dto: ResendOwnerOtpDto, @Req() request: Request) {
    return this.ownerAuth.resendOtp({ ...dto, clientIp: ownerOtpClientIp(request) });
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверка одноразового кода и создание owner session' })
  @ApiOkResponse({ type: OwnerSessionDto })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR', type: AuthErrorDto })
  @ApiResponse({ status: 401, description: 'OTP_INVALID', type: AuthErrorDto })
  @ApiResponse({ status: 404, description: 'OTP_CHALLENGE_NOT_FOUND', type: AuthErrorDto })
  @ApiResponse({ status: 409, description: 'OTP_ALREADY_USED', type: AuthErrorDto })
  @ApiResponse({ status: 410, description: 'OTP_EXPIRED', type: AuthErrorDto })
  @ApiResponse({ status: 500, description: 'INTERNAL_ERROR', type: AuthErrorDto })
  async verifyOtp(@Body() dto: VerifyOwnerOtpDto) {
    return this.ownerAuth.verifyOtp(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Идемпотентный отзыв opaque owner session' })
  async logout(@Headers('authorization') authorization?: string): Promise<void> {
    const token = (/^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1] ?? '').trim();
    await this.ownerAuth.revokeSession(token);
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

  @Get('bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth('bearer')
  async listBookings(
    @CurrentUser() owner: JwtPayload,
    @Query('bucket') bucket?: string,
    @Query('petId') petId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const allowedBuckets = ['REQUIRES_ACTION', 'ACTIVE', 'HISTORY'];
    if (bucket && !allowedBuckets.includes(bucket)) throw new BadRequestException({ code: 'INVALID_BOOKING_BUCKET', message: 'Unsupported booking bucket.' });
    if (petId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(petId)) throw new BadRequestException({ code: 'INVALID_PET_ID', message: 'petId must be a UUID.' });
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException({ code: 'INVALID_LIMIT', message: 'limit must be between 1 and 50.' });
    return this.appointments.listV50(owner, { bucket, petId, cursor, limit });
  }

  @Get('appointments/:holdId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Подробный authoritative snapshot записи владельца' })
  @ApiOkResponse({ description: 'Статус, клиника, питомец, услуга, timeline и доступные действия.' })
  async appointmentDetail(@CurrentUser() owner: JwtPayload, @Param('holdId', new ParseUUIDPipe()) holdId: string) {
    const detail = await this.appointments.read(owner, holdId);
    if (!detail) throw new NotFoundException({ code: 'OWNER_APPOINTMENT_NOT_FOUND', message: 'Appointment was not found for owner.' });
    return detail;
  }

  @Get('bookings/:holdId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth('bearer')
  async bookingDetail(@CurrentUser() owner: JwtPayload, @Param('holdId', new ParseUUIDPipe()) holdId: string) {
    const detail = await this.appointments.read(owner, holdId);
    if (!detail) throw new NotFoundException({ code: 'OWNER_BOOKING_NOT_FOUND', message: 'Booking was not found.' });
    return detail;
  }
}
