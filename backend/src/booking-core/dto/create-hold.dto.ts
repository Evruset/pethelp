import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { mvpScope } from '../../config/mvp-scope.config';

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

  @ApiProperty({ format: 'uuid', required: mvpScope.pilot, description: 'Authoritative clinic selected in the Owner journey.' })
  @ValidateIf(() => mvpScope.pilot)
  @IsUUID('4')
  clinicId?: string;

  @ApiProperty({ format: 'uuid', required: mvpScope.pilot, description: 'Authoritative clinic location selected in the Owner journey.' })
  @ValidateIf(() => mvpScope.pilot)
  @IsUUID('4')
  locationId?: string;

  @ApiProperty({ type: 'integer', minimum: 1, required: mvpScope.pilot, example: 17, description: 'Обязательная в PILOT_V1 версия слота из authoritative availability snapshot.' })
  @ValidateIf((_object, value) => mvpScope.pilot || value !== undefined)
  @IsInt()
  @Min(1)
  expectedSlotVersion?: number;

  @ApiProperty({ format: 'uuid', required: mvpScope.pilot, description: 'Выбранная услуга, повторно проверяемая сервером.' })
  @ValidateIf(() => mvpScope.pilot)
  @IsUUID('4')
  serviceId?: string;

  @ApiProperty({ format: 'uuid', nullable: true, required: false, description: 'Legacy doctor selection.' })
  @ValidateIf(() => !mvpScope.pilot)
  @IsUUID('4')
  doctorId?: string | null;
}
