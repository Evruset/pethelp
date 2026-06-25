import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOwnerOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phone!: string;
}

export class VerifyOwnerOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(36)
  @MaxLength(36)
  challengeId!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class RefreshOwnerSessionDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken!: string;
}

export class RevokeOwnerSessionDto extends RefreshOwnerSessionDto {}
