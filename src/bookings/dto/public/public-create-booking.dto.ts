import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
} from 'class-validator';

export class PublicCreateBookingDto {
  @IsUUID() serviceId!: string;
  @IsUUID() staffId!: string;

  @IsString() customerName!: string;
  @IsOptional() @IsEmail() customerEmail?: string;

  @IsISO8601() startUtc!: string;
  @IsISO8601() endUtc!: string;

  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() channelRef?: string;
}
