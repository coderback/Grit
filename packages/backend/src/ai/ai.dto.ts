import { IsString, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Length(1, 2000)
  message: string;
}

export class AddMemoryDto {
  @IsString()
  @Length(3, 160)
  text: string;
}
