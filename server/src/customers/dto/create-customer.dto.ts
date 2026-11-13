import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  @IsString()
  billingCycle?: string;
}
