import { ArrayMaxSize, IsArray, IsBoolean, IsString, Matches } from 'class-validator';

export class CreateEmergencyTriageDto {
  @IsString()
  @Matches(/^(DOG|CAT|OTHER)$/)
  species!: 'DOG' | 'CAT' | 'OTHER';

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, { each: true })
  signalCodes!: string[];

  @IsBoolean()
  disclaimerAccepted!: boolean;
}
