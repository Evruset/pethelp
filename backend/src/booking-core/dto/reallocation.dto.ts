import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AcceptReallocationOfferDto {
  @ApiProperty({format:'uuid'}) @IsUUID() offerId!:string;
  @ApiProperty({minimum:1}) @Type(()=>Number) @IsInt() @Min(1) caseVersion!:number;
  @ApiProperty({minimum:1}) @Type(()=>Number) @IsInt() @Min(1) offerVersion!:number;
  @ApiProperty({minimum:1}) @Type(()=>Number) @IsInt() @Min(1) slotVersion!:number;
}

export class ReplacementBookingDto {
  @ApiProperty({format:'uuid'}) holdId!:string;
  @ApiProperty({enum:['PENDING_CONFIRMATION','CONFIRMED','REJECTED','EXPIRED']}) status!:'PENDING_CONFIRMATION'|'CONFIRMED'|'REJECTED'|'EXPIRED';
  @ApiProperty({enum:['MANUAL']}) confirmationMode!:'MANUAL';
  @ApiProperty({format:'uuid'}) slotId!:string;
  @ApiProperty({minimum:1}) aggregateVersion!:number;
  @ApiProperty({format:'date-time'}) expiresAt!:string;
}

export class ReallocationOfferDto {
  @ApiProperty({format:'uuid'}) offerId!:string;
  @ApiProperty({minimum:1}) version!:number;
  @ApiProperty({minimum:1,maximum:5}) rank!:number;
  @ApiProperty({format:'uuid'}) clinicId!:string;
  @ApiProperty() clinicName!:string;
  @ApiProperty({format:'uuid'}) locationId!:string;
  @ApiProperty() locationAddress!:string;
  @ApiProperty() timezone!:string;
  @ApiProperty({format:'uuid'}) doctorId!:string;
  @ApiProperty() doctorName!:string;
  @ApiProperty({format:'uuid'}) serviceId!:string;
  @ApiProperty() serviceName!:string;
  @ApiProperty({format:'uuid'}) slotId!:string;
  @ApiProperty({minimum:1}) slotVersion!:number;
  @ApiProperty({format:'date-time'}) startsAt!:string;
  @ApiProperty({format:'date-time'}) endsAt!:string;
  @ApiPropertyOptional({type:Number,nullable:true}) distanceMeters!:number|null;
  @ApiPropertyOptional({type:Number,nullable:true}) priceAmount!:number|null;
  @ApiPropertyOptional({type:String,nullable:true}) priceCurrency!:string|null;
  @ApiProperty({enum:['OFFERED','EXPIRED','INVALIDATED','ACCEPTED']}) status!:string;
  @ApiProperty({format:'date-time'}) expiresAt!:string;
}

export class ReallocationCaseDto {
  @ApiProperty({format:'uuid'}) caseId!:string;
  @ApiProperty({format:'uuid'}) bookingChangeRequestId!:string;
  @ApiProperty({format:'uuid'}) bookingHoldId!:string;
  @ApiProperty({enum:['OPEN','REPLACEMENT_PENDING_CONFIRMATION','CLOSED','CANCELLED']}) status!:string;
  @ApiProperty({enum:['ACTIVE','BOOKING_INELIGIBLE']}) eligibility!:string;
  @ApiProperty({minimum:1}) version!:number;
  @ApiProperty({format:'date-time'}) serverNow!:string;
  @ApiProperty({format:'date-time'}) createdAt!:string;
  @ApiPropertyOptional({type:String,format:'uuid',nullable:true}) acceptedOfferId!:string|null;
  @ApiPropertyOptional({type:ReplacementBookingDto,nullable:true}) replacementBooking!:ReplacementBookingDto|null;
  @ApiProperty({type:[ReallocationOfferDto]}) offers!:ReallocationOfferDto[];
}
