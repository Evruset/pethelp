import { ApiProperty } from '@nestjs/swagger';

export class UpdateClinicPatientLocalAliasRequestDto {
  @ApiProperty({ type: String, nullable: true, minLength: 1, maxLength: 80 })
  alias!: string | null;
}

export class ClinicPatientLocalAliasDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ type: String, nullable: true }) alias!: string | null;
  @ApiProperty({ type: Number, minimum: 1 }) aggregateVersion!: number;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
