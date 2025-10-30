import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  businessName!: string;

  @IsString()
  registrationKey!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

export class RequestResetDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  token!: string;

  @MinLength(8)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsNotEmpty()
  token!: string;
}

export class Verify2faDto {
  @IsNotEmpty()
  code!: string;
}
