import { IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'phone must be a valid E.164 phone number string' })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'otp must be exactly 6 digits' })
  otp: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  favoriteTeam?: string;
}
