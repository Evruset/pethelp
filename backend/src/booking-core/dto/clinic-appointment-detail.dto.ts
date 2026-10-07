import { ApiProperty } from '@nestjs/swagger';

export class ClinicAppointmentDetailAppointmentDto {
  @ApiProperty({ format: 'uuid' }) appointmentId!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) aggregateVersion!: number;
  @ApiProperty({ enum: ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'UNKNOWN'] }) statusCode!: string;
  @ApiProperty() statusLabel!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class ClinicAppointmentDetailScheduleDto {
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() sourceLabel!: string;
}

export class ClinicAppointmentDetailDisplayNameDto {
  @ApiProperty() displayName!: string;
}

export class ClinicAppointmentDetailOwnerDto {
  @ApiProperty({ type: String, nullable: true, description: 'Null when no authoritative Owner name exists.' }) displayName!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Authoritative Owner identity phone, if available.' }) phone!: string | null;
}

export class ClinicAppointmentDetailPetDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() speciesLabel!: string;
  @ApiProperty({ type: String, nullable: true }) breed!: string | null;
}

export class ClinicAppointmentDetailDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ type: ClinicAppointmentDetailAppointmentDto }) appointment!: ClinicAppointmentDetailAppointmentDto;
  @ApiProperty({ type: ClinicAppointmentDetailScheduleDto }) schedule!: ClinicAppointmentDetailScheduleDto;
  @ApiProperty({ type: ClinicAppointmentDetailOwnerDto, nullable: true })
  owner!: ClinicAppointmentDetailOwnerDto | null;
  @ApiProperty({ type: ClinicAppointmentDetailPetDto }) pet!: ClinicAppointmentDetailPetDto;
  @ApiProperty({ type: ClinicAppointmentDetailDisplayNameDto, nullable: true })
  service!: ClinicAppointmentDetailDisplayNameDto | null;
  @ApiProperty({ type: ClinicAppointmentDetailDisplayNameDto, nullable: true })
  veterinarian!: ClinicAppointmentDetailDisplayNameDto | null;
  @ApiProperty({ type: ClinicAppointmentDetailDisplayNameDto, nullable: true })
  resource!: ClinicAppointmentDetailDisplayNameDto | null;
  @ApiProperty({ type: [String], example: [] }) availableActions!: string[];
}
