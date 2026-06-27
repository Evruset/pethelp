import { IsDateString, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateInsuranceProfileDto {
  @IsUUID()
  petId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  insurerCode!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  policyReference!: string;

  @IsString()
  @IsIn(['POLICY_HOLDER_PET', 'DEPENDENT_PET', 'UNKNOWN'])
  petRelation!: 'POLICY_HOLDER_PET' | 'DEPENDENT_PET' | 'UNKNOWN';

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsString()
  @MaxLength(128)
  consentVersion!: string;

  @IsOptional()
  @IsObject()
  providerDataMasked?: Record<string, unknown>;
}
