import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryServiceDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  minPrice?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  maxPrice?: string;

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  minDuration?: number;

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  maxDuration?: number;

  @IsOptional()
  @IsIn(['name', 'price', 'duration', 'createdAt'])
  sortBy?: 'name' | 'price' | 'duration' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number;

  @IsOptional()
  @IsBooleanString()
  withDeleted?: string;
}
