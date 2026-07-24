import { ApiProperty } from '@nestjs/swagger';
import { ClinicPatientOwnerDto, ClinicPatientPetDto, ClinicPatientRelationshipDto } from './clinic-patients-registry.dto';

export class ClinicPatientAppointmentSummaryServiceDto {
  @ApiProperty({ nullable: true, type: String }) displayName!: string | null;
}

export class ClinicPatientAppointmentSummaryVeterinarianDto {
  @ApiProperty({ nullable: true, type: String }) displayName!: string | null;
}

export class ClinicPatientAppointmentSummaryDto {
  @ApiProperty({ format: 'uuid' }) appointmentId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: ['SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'UNKNOWN'] }) statusCode!: string;
  @ApiProperty() statusLabel!: string;
  @ApiProperty({ type: ClinicPatientAppointmentSummaryServiceDto }) service!: ClinicPatientAppointmentSummaryServiceDto;
  @ApiProperty({ type: ClinicPatientAppointmentSummaryVeterinarianDto }) veterinarian!: ClinicPatientAppointmentSummaryVeterinarianDto;
}

export class ClinicPatientDetailAppointmentsDto {
  @ApiProperty({ type: ClinicPatientAppointmentSummaryDto, nullable: true })
  last!: ClinicPatientAppointmentSummaryDto | null;
  @ApiProperty({ type: ClinicPatientAppointmentSummaryDto, nullable: true })
  next!: ClinicPatientAppointmentSummaryDto | null;
  @ApiProperty({ type: [ClinicPatientAppointmentSummaryDto], maxItems: 10 })
  recent!: ClinicPatientAppointmentSummaryDto[];
}

export class ClinicPatientDetailPatientDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ type: ClinicPatientPetDto }) pet!: ClinicPatientPetDto;
  @ApiProperty({ type: ClinicPatientOwnerDto }) owner!: ClinicPatientOwnerDto;
  @ApiProperty({ type: ClinicPatientRelationshipDto }) relationship!: ClinicPatientRelationshipDto;
  @ApiProperty({ type: ClinicPatientDetailAppointmentsDto }) appointments!: ClinicPatientDetailAppointmentsDto;
}

export class ClinicPatientDetailDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ type: ClinicPatientDetailPatientDto })
  patient!: ClinicPatientDetailPatientDto;
}
