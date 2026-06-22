import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { DomainErrors } from '../common/domain-error';
import { CreateHoldDto } from './dto/create-hold.dto';
import { ReleaseHoldDto } from './dto/release-hold.dto';
import { BookingService } from './booking.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (value?: string): value is string => Boolean(value && UUID.test(value));

function idempotencyKey(value?: string): string {
  if (!validUuid(value)) throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be a UUID.' });
  return value;
}

@Controller('v1')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('clinic-locations/:clinicLocationId/slots')
  async listSlots(@Param('clinicLocationId') clinicLocationId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!validUuid(clinicLocationId)) throw DomainErrors.slotNotFound();
    return this.bookingService.listSlots(clinicLocationId, from, to);
  }

  @Post('booking-holds')
  async createHold(@Body() dto: CreateHoldDto, @Headers('idempotency-key') key?: string, @Headers('x-correlation-id') correlationHeader?: string) {
    if (!validUuid(dto.slotId) || !validUuid(dto.ownerId) || !validUuid(dto.petId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'slotId, ownerId and petId must be UUIDs.' });
    }
    const correlationId = validUuid(correlationHeader) ? correlationHeader : randomUUID();
    return this.bookingService.createLocalHold({ ...dto, idempotencyKey: idempotencyKey(key), correlationId });
  }

  @Get('booking-holds/:holdId')
  async getHold(@Param('holdId') holdId: string) {
    if (!validUuid(holdId)) throw DomainErrors.holdNotFound();
    return this.bookingService.findHold(holdId);
  }

  @Post('booking-holds/:holdId/release')
  @HttpCode(HttpStatus.OK)
  async releaseHold(@Param('holdId') holdId: string, @Body() dto: ReleaseHoldDto, @Headers('idempotency-key') key?: string, @Headers('x-correlation-id') correlationHeader?: string) {
    if (!validUuid(holdId) || !validUuid(dto.ownerId)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'Invalid hold or owner id.' });
    const correlationId = validUuid(correlationHeader) ? correlationHeader : randomUUID();
    return this.bookingService.releaseHold({ holdId, ownerId: dto.ownerId, idempotencyKey: idempotencyKey(key), correlationId });
  }

  @Post('clinic/booking-holds/:holdId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmHold(@Param('holdId') holdId: string, @Headers('x-clinic-location-id') clinicLocationId?: string, @Headers('idempotency-key') key?: string, @Headers('x-correlation-id') correlationHeader?: string, @Res({ passthrough: true }) response?: Response) {
    if (!validUuid(holdId) || !validUuid(clinicLocationId)) throw DomainErrors.clinicScopeMismatch();
    const correlationId = validUuid(correlationHeader) ? correlationHeader : randomUUID();
    response?.setHeader('Cache-Control', 'no-store');
    return this.bookingService.confirmManualHold({ holdId, clinicLocationId, idempotencyKey: idempotencyKey(key), correlationId });
  }
}
