import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerateBillDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  /** Any date inside the week/month to bill (weekly & monthly customers). Defaults to today. */
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  /** Pay-per-meal customers: optional custom range. Defaults to all unbilled meals up to today. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** When true, calculates the bill without saving it. */
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}
