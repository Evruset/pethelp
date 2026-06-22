import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

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
}
