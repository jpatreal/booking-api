import { IsUUID } from 'class-validator';

export class IdParamDto {
  @IsUUID()
  id!: string;
}

export class BusinessParamDto {
  @IsUUID()
  businessId!: string;
}
