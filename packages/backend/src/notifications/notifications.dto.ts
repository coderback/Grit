import { IsIn, IsString, Length } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Length(1, 255)
  token: string;

  @IsIn(['ios', 'android', 'web'])
  platform: string;
}
