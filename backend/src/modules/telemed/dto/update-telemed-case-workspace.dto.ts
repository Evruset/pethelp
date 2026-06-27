import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTelemedCaseWorkspaceDto {
  @IsOptional()
  @IsBoolean()
  safetyEscalation?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1600)
  recommendationText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  followUpNotes?: string;
}
