import { IsUUID } from 'class-validator';

export class ProposeAlternativeSlotDto {
  @IsUUID()
  newSlotId!: string;
}
