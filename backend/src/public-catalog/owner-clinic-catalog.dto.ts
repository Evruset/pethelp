import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class OwnerClinicCatalogItemDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
}

export class OwnerClinicCatalogDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: OwnerClinicCatalogItemDto, isArray: true }) clinics!: OwnerClinicCatalogItemDto[];
}

export class OwnerClinicServicePriceDto {
  @ApiProperty({ enum: ['INFORMATIONAL'] }) kind!: 'INFORMATIONAL';
  @ApiProperty({ example: '1250.00' }) amount!: string;
  @ApiProperty({ example: 'RUB' }) currency!: string;
}

export class OwnerClinicServiceDto {
  @ApiProperty({ format: 'uuid' }) serviceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: OwnerClinicServicePriceDto }) price!: OwnerClinicServicePriceDto;
}

export class OwnerClinicServiceCatalogDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ type: OwnerClinicServiceDto, isArray: true }) services!: OwnerClinicServiceDto[];
}

export class OwnerAvailabilitySlotDto {
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$', example: '2026-08-14' }) localDate!: string;
  @ApiProperty({ pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$', example: '14:30' }) localTime!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) expectedVersion!: number;
}

export class OwnerAvailabilityDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty() clinicName!: string;
  @ApiProperty() serviceName!: string;
  @ApiProperty({ example: 'Europe/Moscow' }) timezone!: string;
  @ApiProperty({ format: 'date-time' }) horizonEndsAt!: string;
  @ApiProperty({ type: OwnerAvailabilitySlotDto, isArray: true }) slots!: OwnerAvailabilitySlotDto[];
}

export class OwnerSpecialistDiscoveryQueryDto {
  @ApiProperty({ required: false, format: 'uuid', description: 'Authoritative specialty identity. At least one of specialtyId or serviceCode is required.' })
  @IsOptional() @IsUUID() specialtyId?: string;

  @ApiProperty({ required: false, example: 'PRIMARY_EXAM', description: 'Clinic service taxonomy code, normalized to uppercase. At least one selector is required.' })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{0,79}$/) serviceCode?: string;

  @ApiProperty({ required: false, type: 'integer', minimum: 1, maximum: 50, default: 25 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 25;
}

export class OwnerSpecialistAvailabilitySlotDto {
  @ApiProperty({ format: 'uuid' }) slotId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) expectedVersion!: number;
}

export class OwnerSpecialistDiscoveryDoctorDto {
  @ApiProperty({ format: 'uuid' }) specialtyId!: string;
  @ApiProperty() specialtyName!: string;
  @ApiProperty({ format: 'uuid' }) doctorId!: string;
  @ApiProperty() doctorName!: string;
  @ApiProperty({ format: 'uuid' }) serviceId!: string;
  @ApiProperty() serviceCode!: string;
  @ApiProperty() serviceName!: string;
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty() clinicName!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() address!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ nullable: true, type: Number, minimum: -90, maximum: 90 }) latitude!: number | null;
  @ApiProperty({ nullable: true, type: Number, minimum: -180, maximum: 180 }) longitude!: number | null;
  @ApiProperty({ type: OwnerSpecialistAvailabilitySlotDto, isArray: true, maxItems: 5 }) slots!: OwnerSpecialistAvailabilitySlotDto[];
}

export class OwnerSpecialistDiscoveryDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: 'integer', maximum: 50 }) limit!: number;
  @ApiProperty({ type: OwnerSpecialistDiscoveryDoctorDto, isArray: true }) doctors!: OwnerSpecialistDiscoveryDoctorDto[];
}

export class OwnerSpecialistDiscoverySpecialtyOptionDto {
  @ApiProperty({ format: 'uuid' }) specialtyId!: string;
  @ApiProperty() name!: string;
}

export class OwnerSpecialistDiscoveryServiceOptionDto {
  @ApiProperty() serviceCode!: string;
  @ApiProperty() name!: string;
}

export class OwnerSpecialistDiscoveryOptionsDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: OwnerSpecialistDiscoverySpecialtyOptionDto, isArray: true, maxItems: 100 }) specialties!: OwnerSpecialistDiscoverySpecialtyOptionDto[];
  @ApiProperty({ type: OwnerSpecialistDiscoveryServiceOptionDto, isArray: true, maxItems: 100 }) services!: OwnerSpecialistDiscoveryServiceOptionDto[];
}
