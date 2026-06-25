import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCoverageCheckDto {
  @IsUUID()
  petId!: string;

  @IsString()
  @MaxLength(64)
  partnerCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  consentVersion?: string;
}
