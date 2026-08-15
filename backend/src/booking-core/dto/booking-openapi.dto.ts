import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { mvpScope } from '../../config/mvp-scope.config';

export const BOOKING_STATUS_VALUES = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;

export class HoldDto {
  @ApiProperty({ format: 'uuid', example: '7f04cd21-642a-4c48-8a82-5650ca5ce06c' })
  holdId!: string;

  @(mvpScope.pilot ? ApiHideProperty() : ApiProperty({ format: 'uuid', required: false }))
  appointmentId?: string;

  @ApiProperty({
    enum: BOOKING_STATUS_VALUES,
    enumName: 'BookingStatus',
    description: 'Canonical first-MVP booking status. Internal persistence state is never public.',
  })
  status!: string;

  @ApiProperty({ format: 'uuid', example: '18199595-366a-41bc-bcc9-32c6ae3895a2' })
  slotId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-06-22T18:10:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  lastUpdatedAt!: string;

  @ApiProperty({ format: 'uuid', example: '62c6c50e-b43c-4406-a027-7388e4bff336' })
  correlationId!: string;

  @ApiProperty({ format: 'date-time' })
  serverNow!: string;

  @ApiProperty({ type: 'integer', minimum: 1 })
  aggregateVersion!: number;

  @ApiProperty({ enum: mvpScope.pilot ? ['MANUAL'] : ['AUTOMATIC', 'MANUAL', 'MIS'] })
  confirmationMode!: string;

  @ApiProperty({ enum: ['READ_STATUS'] })
  nextAction!: 'READ_STATUS';
}

class NamedSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

class PetSummaryDto extends NamedSummaryDto {
  @ApiProperty() species!: string;
}

class LocationSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() address!: string;
}

class SlotSummaryDto {
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() timezone!: string;
}

export class BookingHoldReadDto {
  @ApiProperty({ format: 'uuid' }) holdId!: string;
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty({ enum: BOOKING_STATUS_VALUES, enumName: 'BookingStatus' }) status!: string;
  @ApiProperty({ enum: BOOKING_STATUS_VALUES }) statusCode!: string;
  @ApiProperty() statusTitle!: string;
  @ApiProperty() safeDescription!: string;
  @ApiProperty({ enum: ['WAIT', 'VIEW_APPOINTMENT', 'CHOOSE_ANOTHER_SLOT'] }) nextActionCode!: string;
  @ApiProperty({ enum: ['AUTOMATIC', 'MANUAL', 'MIS'] }) confirmationMode!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ minimum: 1 }) aggregateVersion!: number;
  @ApiProperty({ format: 'date-time' }) lastUpdatedAt!: string;
  @ApiProperty({ type: () => PetSummaryDto }) pet!: PetSummaryDto;
  @ApiProperty({ type: () => NamedSummaryDto }) clinic!: NamedSummaryDto;
  @ApiProperty({ type: () => LocationSummaryDto }) location!: LocationSummaryDto;
  @ApiProperty({ type: () => NamedSummaryDto }) service!: NamedSummaryDto;
  @ApiProperty({ type: () => NamedSummaryDto, nullable: true }) doctor!: NamedSummaryDto | null;
  @ApiProperty({ type: () => SlotSummaryDto }) slot!: SlotSummaryDto;
  @ApiProperty({ format: 'uuid' }) clinicLocationId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
}

export class BookingCommandStatusDto {
  @ApiProperty({ format: 'uuid' }) holdId!: string;
  @ApiProperty({ enum: BOOKING_STATUS_VALUES, enumName: 'BookingStatus' }) status!: string;
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty({ format: 'uuid' }) correlationId!: string;
  @ApiProperty({ format: 'uuid', required: false }) appointmentId?: string;
}

export class ConfirmHoldDto {
  @ApiProperty({ format: 'uuid' })
  holdId!: string;

  @ApiProperty({ format: 'uuid' })
  appointmentId!: string;

  @ApiProperty({ enum: ['CONFIRMED'], example: 'CONFIRMED' })
  state!: 'CONFIRMED';

  @ApiProperty({ format: 'uuid' })
  slotId!: string;

  @ApiProperty({ format: 'uuid' })
  correlationId!: string;
}

export class ReleaseHoldDto {
  @ApiProperty({ format: 'uuid' })
  holdId!: string;

  @ApiProperty({ enum: ['RELEASED'], example: 'RELEASED' })
  state!: 'RELEASED';

  @ApiProperty({ format: 'uuid' })
  slotId!: string;

  @ApiProperty({ format: 'uuid' })
  correlationId!: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({ example: 'PET_OWNERSHIP_MISMATCH' })
  code!: string;

  @ApiProperty({ example: 'Pet ownership mismatch' })
  message!: string;

  @ApiProperty({ format: 'uuid', required: false })
  correlationId?: string;

  @ApiProperty({ type: () => Object, required: false })
  details?: Record<string, unknown>;
}

export class BookingHistoryEventDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) bookingId!: string;
  @ApiProperty({ enum: ['BOOKING_REQUESTED', 'BOOKING_CONFIRMED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_EXPIRED'] }) eventType!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ enum: ['OWNER', 'CLINIC', 'SYSTEM'] }) source!: string;
}

export class BookingHistoryCursorDto {
  @ApiProperty({ format: 'date-time' }) occurredAt!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
}

export class BookingHistoryDto {
  @ApiProperty({ format: 'uuid' }) bookingId!: string;
  @ApiProperty({ enum: BOOKING_STATUS_VALUES, enumName: 'BookingStatus' }) status!: string;
  @ApiProperty({ format: 'date-time' }) lastUpdatedAt!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ type: () => [BookingHistoryEventDto] }) events!: BookingHistoryEventDto[];
  @ApiProperty({ type: () => BookingHistoryCursorDto, nullable: true })
  nextCursor!: { occurredAt: string; eventId: string } | null;
}
