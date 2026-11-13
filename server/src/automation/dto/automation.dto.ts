import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAutomationSettingsDto {
  @IsBoolean()
  enabled: boolean;
}

export class GenerateNowDto {
  /** When true, reports what is due without creating any bills (used for the confirmation step). */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
