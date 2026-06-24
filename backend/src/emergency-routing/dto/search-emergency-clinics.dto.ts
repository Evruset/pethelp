import { IsOptional, IsString, Matches } from 'class-validator';

export class SearchEmergencyClinicsDto {
  @IsString()
  @Matches(/^(DOG|CAT|OTHER)$/)
  species!: string;

  @IsOptional()
  @IsString()
  requiredCapabilities?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsString()
  longitude?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
