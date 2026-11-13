import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/^(Expo|Exponent)PushToken\[[^\]]+\]$/, {
    message: 'Invalid Expo push token',
  })
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceId: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web', 'unknown'])
  platform?: 'ios' | 'android' | 'web' | 'unknown';
}

export class UnregisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceId: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  billingNotifications?: boolean;
}
