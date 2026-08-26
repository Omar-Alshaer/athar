import { IsEmail, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;
}
