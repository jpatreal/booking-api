import { IsOptional, IsUUID } from 'class-validator';

export class BusinessIdDto {
  @IsUUID()
  businessId!: string;

  @IsUUID()
  @IsOptional()
  id?: string;
}
