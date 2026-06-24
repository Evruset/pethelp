import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CollectMisTimeoutDto {
  @IsUUID()
  correlationId!: string;

  @IsUUID()
  holdId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(65_536)
  rawHttpDump!: string;
}
