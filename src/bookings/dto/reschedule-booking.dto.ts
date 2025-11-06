import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class RescheduleBookingDto {
  @IsISO8601() startUtc!: string;
  @IsISO8601() endUtc!: string;
  @IsOptional() @IsString() note?: string;
}
