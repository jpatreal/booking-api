import {
  IsBooleanString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { UserOrEmailXor } from './validator/user-or-email.validator';
import { Type } from 'class-transformer';

export class BizIdDto {
  @IsUUID()
  businessId!: string;
}

export class MembershipIdDto extends BizIdDto {
  @IsUUID()
  membershipId!: string;
}

export class RoleDto {
  @IsIn(['OWNER', 'MANAGER', 'STAFF'])
  role!: 'OWNER' | 'MANAGER' | 'STAFF';
}

export class AddMemberDto extends RoleDto {
  @IsOptional()
  @IsUUID()
  @UserOrEmailXor('email')
  userId?: string;

  @IsOptional()
  @IsEmail()
  @UserOrEmailXor('userId')
  email?: string;
}

export class TransferOwnerDto {
  @IsUUID()
  toMembershipId!: string;

  @IsOptional()
  @IsUUID()
  fromMembershipId?: string | null;
}

export class QueryParamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  q?: string;

  @IsBooleanString()
  @IsOptional()
  includeDisabled?: string;
}
