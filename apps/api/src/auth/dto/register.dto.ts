import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  @Matches(/^[^<>\p{Cc}]+$/u, { message: 'الاسم يحتوي على أحرف غير مسموحة.' })
  fullName!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  phoneCountry!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/^(?=.*\p{L})(?=.*\d).+$/u, {
    message: 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل.',
  })
  password!: string;
}
