import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BusinessHoursPayloadDto } from './business-hours.dto';
import { AddressDto } from './create-business.dto';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional() @IsUrl() logoUrl?: string;
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
