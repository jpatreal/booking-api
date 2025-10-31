import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  registrationKey?: string;

  @ValidateIf((o) => !!o.registrationKey && !o.inviteToken)
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @IsOptional()
  @IsString()
  inviteToken?: string;
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
