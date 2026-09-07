import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DoctorMappingRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() staffId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() doctorId!: string;
}

export class DoctorServiceRequestDto extends DoctorMappingRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() serviceId!: string;
  @ApiProperty({ type:String, format: 'uuid', nullable: true, required: false }) @IsOptional() @IsUUID() resourceId?: string | null;
}

export class DoctorShiftRequestDto extends DoctorMappingRequestDto {
  @ApiProperty({ description: 'Clinic-local datetime or ISO-8601 instant.', example: '2026-09-10T09:00' }) @IsString() startsAt!: string;
  @ApiProperty({ description: 'Clinic-local datetime or ISO-8601 instant.', example: '2026-09-10T12:00' }) @IsString() endsAt!: string;
}

export class DoctorShiftUpdateRequestDto {
  @ApiProperty({ description: 'Clinic-local datetime or ISO-8601 instant.', example: '2026-09-10T09:00' }) @IsString() startsAt!: string;
  @ApiProperty({ description: 'Clinic-local datetime or ISO-8601 instant.', example: '2026-09-10T12:00' }) @IsString() endsAt!: string;
}

export class DoctorShiftResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ format: 'uuid' }) staffId!: string;
  @ApiProperty({ format: 'uuid' }) doctorId!: string;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ example: 'Europe/Moscow' }) timezone!: string;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'BLOCKED', 'CANCELLED'] }) status!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) generationVersion!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class DoctorMappingResponseDto {
  @ApiProperty({ format: 'uuid', name: 'staff_id' }) staff_id!: string;
  @ApiProperty({ format: 'uuid', name: 'doctor_id' }) doctor_id!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}

export class DoctorServiceResponseDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty({format:'uuid',name:'clinic_location_id'}) clinic_location_id!:string;
  @ApiProperty({format:'uuid',name:'staff_id'}) staff_id!:string;
  @ApiProperty({format:'uuid',name:'doctor_id'}) doctor_id!:string;
  @ApiProperty({format:'uuid',name:'service_id'}) service_id!:string;
  @ApiProperty({type:String,format:'uuid',nullable:true,name:'resource_id'}) resource_id!:string|null;
  @ApiProperty({type:'integer',enum:[1],name:'slot_capacity'}) slot_capacity!:1;
  @ApiProperty() active!:boolean;
  @ApiProperty({type:'integer',minimum:1}) version!:number;
}

export class DoctorShiftInventoryResponseDto {
  @ApiProperty({format:'uuid'}) clinicId!:string;
  @ApiProperty({format:'uuid'}) locationId!:string;
  @ApiProperty({example:'Europe/Moscow'}) timezone!:string;
  @ApiProperty({description:'False during rollout rollback; every mutation fails closed.'}) mutationEnabled!:boolean;
  @ApiProperty({type:[DoctorShiftResponseDto]}) shifts!:DoctorShiftResponseDto[];
  @ApiProperty({type:[DoctorServiceResponseDto]}) doctorServices!:DoctorServiceResponseDto[];
  @ApiProperty({type:'array',items:{type:'object',additionalProperties:false}}) doctors!:Record<string,unknown>[];
  @ApiProperty({type:'array',items:{type:'object',additionalProperties:false}}) veterinarians!:Record<string,unknown>[];
  @ApiProperty({type:'array',items:{type:'object',additionalProperties:false}}) catalogDoctors!:Record<string,unknown>[];
  @ApiProperty({type:'array',items:{type:'object'}}) runs!:Record<string,unknown>[];
  @ApiProperty({type:'array',items:{type:'object'}}) generatedSlots!:Record<string,unknown>[];
}

export class InventoryGenerationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) shiftId!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) shiftVersion!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) generationVersion!: number;
  @ApiProperty({ enum: ['GENERATED', 'PUBLISHED'] }) status!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) slotCount!: number;
  @ApiProperty({ pattern: '^[0-9a-f]{64}$' }) rulesFingerprint!: string;
}

export class InventoryPublicationResponseDto {
  @ApiProperty({ format: 'uuid' }) runId!: string;
  @ApiProperty({ format: 'uuid' }) shiftId!: string;
  @ApiProperty({ enum: ['PUBLISHED', 'UNPUBLISHED'] }) publicationState!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) slotCount!: number;
}
