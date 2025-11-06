import {
  IsUUID,
  IsISO8601,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsEmail,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID() serviceId!: string;
  @IsUUID() staffId!: string;

  @IsOptional() @IsUUID() customerId?: string;

  @IsString() customerName!: string;
  @IsOptional() @IsEmail() customerEmail?: string;

  @IsISO8601() startUtc!: string;
  @IsISO8601() endUtc!: string;

  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsInt() @Min(0) bookedPriceCents?: number;
  @IsOptional() @IsInt() @Min(0) bookedDurationMin?: number;

  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() channelRef?: string;
}
