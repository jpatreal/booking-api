import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BizIdDto } from './memberships.dto';

export class ResendInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlHours?: number;

  @IsOptional()
  @IsBoolean()
  returnTokenForDev?: boolean;
}

export class VerifyInviteQuery {
  @IsString()
  token!: string;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;
}

export class ResendInviteIdDto extends BizIdDto {
  @IsUUID()
  inviteId!: string;
}
