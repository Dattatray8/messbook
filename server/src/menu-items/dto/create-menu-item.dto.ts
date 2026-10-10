import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['BREAKFAST', 'LUNCH', 'DINNER', 'EXTRA'])
  category: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'EXTRA';

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  unit?: string;
}
