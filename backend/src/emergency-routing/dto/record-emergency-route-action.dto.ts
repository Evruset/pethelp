import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RecordEmergencyRouteActionDto {
  @IsIn(['CALL_STARTED', 'ROUTE_OPENED', 'FOLLOW_UP_REQUESTED'])
  action!: 'CALL_STARTED' | 'ROUTE_OPENED' | 'FOLLOW_UP_REQUESTED';

  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  triageSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
