import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class ReviewEmergencyProfileDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';

  /** Required for VERIFIED to avoid promoting a stale clinic declaration. */
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
