import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  description: string;

  @IsInt()
  @IsPositive()
  durationMin!: number;

  @Matches(/^\d+(\.\d{1,2})?$/)
  price!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
