import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOwnerPetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(['DOG', 'CAT', 'OTHER'])
  species!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MALE', 'FEMALE', 'UNKNOWN'])
  sex?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(999.99)
  weightKg?: number;

  @IsOptional()
  @IsBoolean()
  sterilized?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  vaccinationNotes?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  insurancePolicyLinks?: string[];
}

export class UpdateOwnerPetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DOG', 'CAT', 'OTHER'])
  species?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MALE', 'FEMALE', 'UNKNOWN'])
  sex?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(999.99)
  weightKg?: number;

  @IsOptional()
  @IsBoolean()
  sterilized?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicConditions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  vaccinationNotes?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  insurancePolicyLinks?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mutationId?: string;
}
