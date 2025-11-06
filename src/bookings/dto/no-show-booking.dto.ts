import { IsOptional, IsString } from 'class-validator';

export class NoShowBookingDto {
  @IsOptional() @IsString() note?: string;
}
