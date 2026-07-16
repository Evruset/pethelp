import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateHoldDto {
  @ApiProperty({
    format: 'uuid',
    example: '18199595-366a-41bc-bcc9-32c6ae3895a2',
    description: 'Идентификатор открытого слота.',
  })
  @IsUUID('4')
  slotId!: string;

  @ApiProperty({
    format: 'uuid',
    example: '8cb2d9ec-5dee-4bb9-9bc7-1ad2b7b5693e',
    description: 'Питомец, принадлежащий authenticated OWNER.',
  })
  @IsUUID('4')
  petId!: string;

  @ApiProperty({ minimum: 1, example: 17, required: false, description: 'Версия слота из authoritative availability snapshot. Обязательна для V50; временно optional для legacy rollback.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedSlotVersion?: number;

  @ApiProperty({ format: 'uuid', required: false, description: 'Выбранная услуга, повторно проверяемая сервером. Обязательна для V50; временно optional для legacy rollback.' })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'Выбранный врач либо null для слота без врача.' })
  @IsOptional()
  @IsUUID('4')
  doctorId!: string | null;
}
