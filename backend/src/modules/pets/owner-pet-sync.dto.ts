import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsDateString, IsInt, IsObject, IsString, IsUUID, Min } from 'class-validator';

export class OwnerPetMutationDto {
  @IsUUID()
  mutationId!: string;

  @IsUUID()
  deviceId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceSequence!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseServerVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  payloadSchemaVersion!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  changedFields!: string[];

  @IsDateString()
  clientOccurredAt!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
