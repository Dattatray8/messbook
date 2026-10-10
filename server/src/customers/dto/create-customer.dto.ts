import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['PAY_PER_MEAL', 'WEEKLY', 'MONTHLY'])
  billingType?: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';

  @IsOptional()
  @IsNumber()
  @Min(0)
  planAmount?: number;

  @IsOptional()
  @IsString()
  billingCycle?: string;
}
