import { ApiProperty } from '@nestjs/swagger';

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
