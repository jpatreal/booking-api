import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  IsISO8601,
  Min,
} from 'class-validator';

export class ListBookingsQueryDto {
  @IsOptional() @IsUUID() staffId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() customerId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'])
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';

  @IsOptional() @IsISO8601() startUtcFrom?: string;
  @IsOptional() @IsISO8601() startUtcTo?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) pageSize?: number = 20;
}
