import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export const TELEMED_INTAKE_CATEGORIES = [
  'GENERAL_QUESTION',
  'SKIN_EAR_EYE',
  'NUTRITION',
  'BEHAVIOR',
  'MEDICATION_QUESTION',
  'POST_VISIT_FOLLOW_UP',
  'VOMITING_DIARRHEA',
  'PAIN_LAMENESS',
  'OTHER',
] as const;

export const TELEMED_SYMPTOM_DURATIONS = [
  'LESS_THAN_24H',
  'ONE_TO_THREE_DAYS',
  'MORE_THAN_THREE_DAYS',
  'NO_SYMPTOMS',
] as const;

export class CreateTelemedIntakeDto {
  @IsUUID()
  petId!: string;

  @IsIn(TELEMED_INTAKE_CATEGORIES)
  category!: (typeof TELEMED_INTAKE_CATEGORIES)[number];

  @IsIn(TELEMED_SYMPTOM_DURATIONS)
  symptomDuration!: (typeof TELEMED_SYMPTOM_DURATIONS)[number];

  @IsBoolean()
  priorClinicVisit!: boolean;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, { each: true })
  emergencyRedFlags!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  attachmentRefs?: string[];

  @IsString()
  @MaxLength(80)
  consentVersion!: string;

  @IsOptional()
  @IsIn(['STANDARD', 'EXPRESS'])
  expectedServiceLevel?: 'STANDARD' | 'EXPRESS';
}
