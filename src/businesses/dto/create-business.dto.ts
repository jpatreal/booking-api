import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BusinessHoursPayloadDto } from './business-hours.dto';

export class AddressDto {
  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  slng?: number;
}

export class CreateBusinessDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessHoursPayloadDto)
  hours?: BusinessHoursPayloadDto;
}
