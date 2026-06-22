import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DomainErrors } from '../common/domain-error';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import { CreateHoldDto } from './dto/create-hold.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string): value is string => Boolean(value && UUID.test(value));

function requiredUuid(value: string | undefined, field: string): string {
  if (!isUuid(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

@Controller('v1')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingSecurityService: BookingSecurityService,
  ) {}

  @Get('clinic-locations/:clinicLocationId/slots')
  async listSlots(@Param('clinicLocationId') clinicLocationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!isUuid(clinicLocationId)) throw DomainErrors.slotNotFound();
    return this.bookingService.listSlots(clinicLocationId, from, to);
  }

  @Post('booking-holds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async createHold(
    @Body() dto: CreateHoldDto,
    @CurrentUser() owner: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.bookingService.createLocalHold({
      slotId: requiredUuid(dto.slotId, 'slotId'),
      petId: requiredUuid(dto.petId, 'petId'),
      ownerId: owner.sub,
      idempotencyKey: requiredUuid(idempotencyKey, 'Idempotency-Key'),
      correlationId: isUuid(correlationHeader) ? correlationHeader : randomUUID(),
    });
  }

  @Get('booking-holds/:holdId')
  async getHold(@Param('holdId') holdId: string) {
    if (!isUuid(holdId)) throw DomainErrors.holdNotFound();
    return this.bookingService.findHold(holdId);
  }

  @Post('booking-holds/:holdId/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.SYSTEM_WORKER)
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
