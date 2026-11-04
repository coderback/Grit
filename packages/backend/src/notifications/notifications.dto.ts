import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Length(1, 255)
  token: string;

  @IsIn(['ios', 'android', 'web'])
  platform: string;
}

export class UnregisterPushTokenDto {
  @IsString()
  @Length(1, 255)
  token: string;
}

export class MarkReadDto {
  // Leave out to mark everything read
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids?: string[];
}

export class ListNotificationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  before?: string;
}
