import { ApiProperty } from '@nestjs/swagger';

export class HoldDto {
  @ApiProperty({ format: 'uuid', example: '7f04cd21-642a-4c48-8a82-5650ca5ce06c' })
  holdId!: string;

  @ApiProperty({
    enum: ['MANUAL_CONFIRM_PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED'],
    example: 'MANUAL_CONFIRM_PENDING',
  })
  state!: string;

  @ApiProperty({ format: 'uuid', example: '18199595-366a-41bc-bcc9-32c6ae3895a2' })
  slotId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-06-22T18:10:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid', example: '62c6c50e-b43c-4406-a027-7388e4bff336' })
  correlationId!: string;
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
}
