import { IsOptional, IsString } from 'class-validator';

export class ConfirmBookingDto {
  @IsOptional() @IsString() note?: string;
}
