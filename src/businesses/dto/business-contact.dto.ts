import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class BusinessContactDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl({}, { message: 'website must be a valid URL' })
  website?: string;

  @IsOptional()
  @IsUrl({}, { message: 'facebookUrl must be a valid URL' })
  facebookUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'instagramUrl must be a valid URL' })
  instagramUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'tiktokUrl must be a valid URL' })
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  messenger?: string;

  @IsOptional()
  @IsString()
  viber?: string;
}
