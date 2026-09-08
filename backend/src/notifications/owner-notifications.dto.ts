import { ApiProperty } from '@nestjs/swagger';

export class OwnerNotificationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'] }) notificationType!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'uuid' }) bookingHoldId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) appointmentId!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class OwnerNotificationListDto {
  @ApiProperty({ type: () => [OwnerNotificationDto] }) notifications!: OwnerNotificationDto[];
}
