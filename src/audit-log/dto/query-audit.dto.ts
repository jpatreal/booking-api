import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';

export class QueryAuditDto {
  @IsOptional() @IsString() businessId?: string;
  @IsOptional() @IsString() actorUserId?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() cursor?: string | null;
  @IsOptional() @IsInt() @Min(1) take?: number;

  @IsOptional() @IsIn(['csv', 'ndjson']) format?: 'csv' | 'ndjson';
}
