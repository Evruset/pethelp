import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CollectLatePaymentDto {
  @IsUUID()
  correlationId!: string;

  @IsUUID()
  paymentIntentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(65_536)
  rawHttpDump!: string;
}
