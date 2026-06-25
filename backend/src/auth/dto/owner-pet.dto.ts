import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOwnerPetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(['DOG', 'CAT', 'OTHER'])
  species!: string;
}
