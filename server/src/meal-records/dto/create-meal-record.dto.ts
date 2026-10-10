import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MealLineDto {
  @IsString()
  @IsNotEmpty()
  menuItemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

/** Prices are never accepted from the client: they are read from the stored menu item. */
export class CreateMealRecordDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsEnum(['BREAKFAST', 'LUNCH', 'DINNER'])
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';

  /** 'YYYY-MM-DD' or ISO date-time. Defaults to now. */
  @IsOptional()
  @IsDateString()
  mealDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MealLineDto)
  items: MealLineDto[];
}
