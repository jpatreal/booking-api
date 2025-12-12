import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { planEnum } from '@app/db/schema';

export class RenewPlanDto {
  @IsOptional()
  @IsIn(planEnum.enumValues)
  plan?: (typeof planEnum.enumValues)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodMonths?: number;
}

export class businessIdParam {
  @IsUUID()
  businessId!: string;
}
