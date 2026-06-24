import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsISO8601, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { EMERGENCY_STATUSES, EMERGENCY_SPECIES } from '../emergency-routing.types';

export class EmergencyCapabilityDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/)
  capabilityCode!: string;

  @IsString()
  species!: (typeof EMERGENCY_SPECIES)[number];

  @IsBoolean()
  available24x7!: boolean;

  @IsString()
  source!: string;

  @IsOptional()
  @IsString()
  evidenceReference?: string;
}

/** Clinic-owned declaration. PostgreSQL always resets certification after a submission. */
export class UpsertEmergencyProfileDto {
  @IsString()
  emergencyStatus!: (typeof EMERGENCY_STATUSES)[number];

  /** Kept only for legacy clients. Its value is overridden by the database boundary. */
  @IsOptional()
  @IsString()
  verificationStatus: string = 'PENDING';

  @IsISO8601()
  validUntil!: string;

  @IsString()
  capabilityVersion!: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EmergencyCapabilityDto)
  capabilities!: EmergencyCapabilityDto[];
}
