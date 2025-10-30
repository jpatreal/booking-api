import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ListBusinessQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsBooleanString()
  includeDeleted?: string;
}

export class BusinessIdDto {
  @IsUUID()
  businessId!: string;
}

export class BusinessIdOrSlugDto {
  @IsString()
  idOrSlug!: string;
}
