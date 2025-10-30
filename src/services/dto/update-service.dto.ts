import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  durationMin?: number;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  price?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
