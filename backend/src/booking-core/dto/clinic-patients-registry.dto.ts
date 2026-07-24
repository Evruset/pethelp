import { ApiProperty } from '@nestjs/swagger';

export class ClinicPatientPetDto {
  @ApiProperty() displayName!: string;
  @ApiProperty() speciesLabel!: string;
  @ApiProperty({ nullable: true, type: String }) breed!: string | null;
  @ApiProperty({ nullable: true, enum: ['MALE', 'FEMALE', 'UNKNOWN'] }) sexCode!: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  @ApiProperty({ nullable: true, type: String, format: 'date' }) birthDate!: string | null;
}

export class ClinicPatientOwnerDto {
  @ApiProperty({ nullable: true, type: String }) displayName!: null;
}

export class ClinicPatientRelationshipDto {
  @ApiProperty({ format: 'date-time' }) firstSeenAt!: string;
  @ApiProperty({ format: 'date-time' }) lastSeenAt!: string;
}

export class ClinicPatientAppointmentsDto {
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastVisitAt!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) nextAppointmentAt!: string | null;
}

export class ClinicPatientRegistryItemDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ type: ClinicPatientPetDto }) pet!: ClinicPatientPetDto;
  @ApiProperty({ type: ClinicPatientOwnerDto }) owner!: ClinicPatientOwnerDto;
  @ApiProperty({ type: ClinicPatientRelationshipDto }) relationship!: ClinicPatientRelationshipDto;
  @ApiProperty({ type: ClinicPatientAppointmentsDto }) appointments!: ClinicPatientAppointmentsDto;
}

export class ClinicPatientsRegistryDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ type: [ClinicPatientRegistryItemDto] }) items!: ClinicPatientRegistryItemDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}
