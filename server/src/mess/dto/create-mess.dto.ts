import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMessDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['BREAKFAST', 'LUNCH', 'DINNER'], { each: true })
  mealTypes?: Array<'BREAKFAST' | 'LUNCH' | 'DINNER'>;
}
