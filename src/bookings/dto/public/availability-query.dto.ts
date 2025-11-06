import { IsUUID, IsISO8601, IsOptional, IsString } from 'class-validator';

export class AvailabilityQueryDto {
  @IsUUID() serviceId!: string;
  @IsUUID() staffId!: string;

  @IsOptional() @IsString() dateLocal?: string;
  @IsOptional() @IsISO8601() startUtcFrom?: string;
  @IsOptional() @IsISO8601() startUtcTo?: string;
}
