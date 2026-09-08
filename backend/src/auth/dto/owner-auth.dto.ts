import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RequestOwnerOtpDto {
  @ApiProperty({ example: '+79991234567', description: 'Normalized public E.164 phone input.' })
  @IsString()
  @MaxLength(32)
  phone!: string;
}

export class VerifyOwnerOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  challengeId!: string;

  @ApiProperty({ example: '123456', pattern: '^\\d{6}$', writeOnly: true })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class ResendOwnerOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  challengeId!: string;
}

export class OwnerOtpChallengeDto {
  @ApiProperty({ format: 'uuid' }) challengeId!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time' }) resendAvailableAt!: string;
}

export class OwnerIdentityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}

export class OwnerSessionDto {
  @ApiProperty({ example: 'vh_<opaque>', pattern: '^vh_[A-Za-z0-9_-]{64}$', description: 'Opaque credential returned once; clients must not parse it.' }) sessionToken!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: OwnerIdentityDto }) owner!: OwnerIdentityDto;
}

export class AuthErrorDto {
  @ApiProperty({ enum: [
    'VALIDATION_ERROR', 'OTP_INVALID', 'OTP_EXPIRED', 'OTP_RESEND_COOLDOWN',
    'OTP_RATE_LIMITED', 'OTP_TEMPORARILY_BLOCKED', 'OTP_CHALLENGE_NOT_FOUND',
    'OTP_ALREADY_USED', 'OTP_PROVIDER_UNAVAILABLE', 'OTP_PROVIDER_TIMEOUT',
    'OTP_PROVIDER_OUTCOME_UNKNOWN', 'INVALID_SESSION', 'INTERNAL_ERROR',
  ] }) code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ format: 'uuid', required: false }) correlationId?: string;
  @ApiProperty({ format: 'date-time', required: false }) retryAt?: string;
  @ApiProperty({ minimum: 0, maximum: 5, required: false }) attemptsRemaining?: number;
}

export class EffectiveSessionScopeDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
}

export class EffectiveOwnerSessionDto {
  @ApiProperty({ format: 'uuid' }) subjectId!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ type: [String] }) effectiveCapabilities!: string[];
  @ApiProperty({ type: [EffectiveSessionScopeDto] }) clinicScopes!: EffectiveSessionScopeDto[];
}
