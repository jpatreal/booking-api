import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { BusinessHoursPayloadDto } from './business-hours.dto';

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
  @ValidateNested()
  @Type(() => BusinessHoursPayloadDto)
  hours?: BusinessHoursPayloadDto;
}
