import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+()\-\s\d]{8,24}$/)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
