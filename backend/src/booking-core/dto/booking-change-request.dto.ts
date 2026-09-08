import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BookingChangeRequestType { CANCEL='CANCEL', RESCHEDULE='RESCHEDULE' }
export enum BookingChangeRequestStatus { OPEN='OPEN', PROCESSING='PROCESSING', COMPLETED='COMPLETED', REJECTED='REJECTED', CANCELLED='CANCELLED' }

export class CreateBookingChangeRequestDto {
  @ApiProperty({enum:BookingChangeRequestType})
  @IsEnum(BookingChangeRequestType)
  requestType!: BookingChangeRequestType;
}

export class BookingChangeRequestDto {
  @ApiProperty({format:'uuid'}) requestId!: string;
  @ApiProperty({enum:BookingChangeRequestType}) requestType!: BookingChangeRequestType;
  @ApiProperty({enum:BookingChangeRequestStatus}) status!: BookingChangeRequestStatus;
  @ApiProperty({format:'uuid'}) bookingHoldId!: string;
  @ApiPropertyOptional({type:String,format:'uuid',nullable:true}) appointmentId!: string|null;
  @ApiProperty({format:'uuid'}) clinicId!: string;
  @ApiProperty({format:'uuid'}) locationId!: string;
  @ApiProperty({format:'uuid'}) slotId!: string;
  @ApiProperty({minimum:1}) version!: number;
  @ApiProperty({format:'date-time'}) createdAt!: string;
  @ApiProperty({format:'date-time'}) stateChangedAt!: string;
  @ApiProperty({format:'date-time'}) updatedAt!: string;
  @ApiPropertyOptional({type:String,format:'date-time',nullable:true}) terminalAt!: string|null;
}

export class OperationsBookingChangeRequestQueryDto {
  @ApiPropertyOptional({enum:BookingChangeRequestStatus}) @IsOptional() @IsEnum(BookingChangeRequestStatus) status?:BookingChangeRequestStatus;
  @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() locationId?:string;
  @ApiPropertyOptional({minimum:1,maximum:50,default:25}) @IsOptional() @Type(()=>Number) @Transform(({value})=>Number(value)) @IsInt() @Min(1) @Max(50) limit=25;
}

export class OperationsBookingChangeRequestItemDto extends BookingChangeRequestDto {}

export class OperationsBookingChangeRequestDetailDto extends BookingChangeRequestDto {
  @ApiProperty({format:'date-time'}) serverNow!:string;
  @ApiProperty() currentBookingStatus!:string;
  @ApiPropertyOptional({type:String,nullable:true}) currentAppointmentStatus!:string|null;
  @ApiProperty({type:()=>[OperationsReplacementSlotDto]}) replacementSlots!:OperationsReplacementSlotDto[];
}

export class OperationsReplacementSlotDto {
  @ApiProperty({format:'uuid'}) slotId!:string;
  @ApiProperty({format:'date-time'}) startsAt!:string;
  @ApiProperty({format:'date-time'}) endsAt!:string;
  @ApiProperty({minimum:1}) version!:number;
}

export class ProcessBookingChangeRequestDto {
  @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() replacementSlotId?:string;
  @ApiPropertyOptional({minimum:1}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) replacementSlotVersion?:number;
}

export class OperationsBookingChangeRequestPageDto {
  @ApiProperty({format:'date-time'}) observedAt!:string;
  @ApiProperty({type:[OperationsBookingChangeRequestItemDto]}) items!:OperationsBookingChangeRequestItemDto[];
}
