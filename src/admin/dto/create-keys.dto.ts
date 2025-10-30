import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
export class CreateKeysDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['TEST', 'TRIAL', 'FREE', 'PRO'])
  plan?: 'TEST' | 'TRIAL' | 'FREE' | 'PRO';

  @IsOptional()
  @IsNumber()
  trialDays?: number;

  @IsOptional()
  @IsNumber()
  maxUses?: number;

  @IsOptional()
  @IsString()
  emailDomain?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
