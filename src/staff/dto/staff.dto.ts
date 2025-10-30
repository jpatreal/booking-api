import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  IsUUID,
  IsHexColor,
  IsArray,
  ValidateNested,
  IsIn,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessParamDto {
  @IsUUID()
  businessId!: string;
}

export class StaffParamDto extends BusinessParamDto {
  @IsUUID()
  staffId!: string;
}

export class StaffServiceParamDto extends StaffParamDto {
  @IsUUID()
  serviceId!: string;
}

export class StaffAvailabilityDto extends StaffParamDto {
  @IsNumberString()
  dayOfWeek!: string;
}

export class StaffTimeOffDto extends StaffParamDto {
  @IsUUID()
  timeOffId!: string;
}

export class ListStaffQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
  @IsOptional() @Type(() => Boolean) @IsBoolean() activeOnly: boolean = true;
}

export class CreateStaffDto {
  @IsString() @Length(1, 150) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @IsUUID() userId?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @Length(1, 150) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class UpsertStaffServiceDto {
  @IsUUID() serviceId!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCentsOverride?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMinOverride?:
    | number
    | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferBeforeMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferAfterMin?: number;
}

export class BulkUpsertStaffServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStaffServiceDto)
  items!: UpsertStaffServiceDto[];
}

export class UpsertAvailabilityDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() startTimeLocal!: string;
  @IsString() endTimeLocal!: string;
}

export class BulkUpsertAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAvailabilityDto)
  items!: UpsertAvailabilityDto[];
}

export class CreateTimeOffDto {
  @IsString() startUtc!: string;
  @IsString() endUtc!: string;
  @IsOptional() @IsString() reason?: string;
}

export class WalkInBookingDto {
  @IsUUID() serviceId!: string;
  @IsString() customerName!: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsString() startUtc!: string;
  @IsString() endUtc!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() force?: boolean;
}
