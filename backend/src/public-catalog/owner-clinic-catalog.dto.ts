import { ApiProperty } from '@nestjs/swagger';

export class OwnerClinicNextAvailabilityDto {
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }) localDate!: string;
  @ApiProperty({ pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' }) localTime!: string;
  @ApiProperty({ maxLength: 64, pattern: '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)+$', example: 'Europe/Moscow' }) timezone!: string;
}

export class OwnerClinicInformationalPriceDto {
  @ApiProperty({ enum: ['FROM'] }) kind!: 'FROM';
  @ApiProperty({ pattern: '^\\d{1,10}\\.\\d{2}$' }) amount!: string;
  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'RUB' }) currency!: string;
}

export class OwnerClinicConfirmationDto {
  @ApiProperty({ enum: ['MANUAL'] }) mode!: 'MANUAL';
}

export class OwnerClinicDecisionSummaryDto {
  @ApiProperty({ nullable: true, type: OwnerClinicNextAvailabilityDto }) nextAvailability!: OwnerClinicNextAvailabilityDto | null;
  @ApiProperty({ nullable: true, type: OwnerClinicInformationalPriceDto }) informationalPrice!: OwnerClinicInformationalPriceDto | null;
  @ApiProperty({ type: OwnerClinicConfirmationDto }) confirmation!: OwnerClinicConfirmationDto;
}

export class OwnerClinicCatalogItemDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ type: OwnerClinicDecisionSummaryDto }) decisionSummary!: OwnerClinicDecisionSummaryDto;
}

export class OwnerClinicCatalogDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ type: OwnerClinicCatalogItemDto, isArray: true }) clinics!: OwnerClinicCatalogItemDto[];
}

export class OwnerClinicServicePriceDto {
  @ApiProperty({ enum: ['INFORMATIONAL'] }) kind!: 'INFORMATIONAL';
  @ApiProperty({ pattern: '^\\d{1,10}\\.\\d{2}$', example: '1250.00' }) amount!: string;
  @ApiProperty({ pattern: '^[A-Z]{3}$', example: 'RUB' }) currency!: string;
}

export class OwnerClinicServiceSpecialtyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class OwnerClinicServiceSpecialistDto {
  @ApiProperty({ format: 'uuid' }) doctorId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() specialtyName!: string;
  @ApiProperty({ type: OwnerClinicNextAvailabilityDto }) nextAvailability!: OwnerClinicNextAvailabilityDto;
}

export class OwnerClinicServiceDto {
  @ApiProperty({ format: 'uuid' }) serviceId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: OwnerClinicServicePriceDto }) price!: OwnerClinicServicePriceDto;
  @ApiProperty({ nullable: true, type: OwnerClinicServiceSpecialtyDto }) specialty!: OwnerClinicServiceSpecialtyDto | null;
  @ApiProperty({ type: OwnerClinicServiceSpecialistDto, isArray: true, maxItems: 10 }) specialists!: OwnerClinicServiceSpecialistDto[];
}

export class OwnerClinicServiceCatalogDto {
  @ApiProperty({ format: 'date-time' }) observedAt!: string;
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ type: OwnerClinicServiceDto, isArray: true, maxItems: 50 }) services!: OwnerClinicServiceDto[];
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
  @ApiProperty({ maxLength: 64, pattern: '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)+$', example: 'Europe/Moscow' }) timezone!: string;
  @ApiProperty({ format: 'date-time' }) horizonEndsAt!: string;
  @ApiProperty({ type: OwnerClinicServicePriceDto }) informationalPrice!: OwnerClinicServicePriceDto;
  @ApiProperty({ type: OwnerAvailabilitySlotDto, isArray: true }) slots!: OwnerAvailabilitySlotDto[];
}
