import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsIn(['MANAGER', 'STAFF'])
  role!: 'MANAGER' | 'STAFF';

  @IsOptional()
  @IsInt()
  @Min(1)
  ttlHours?: number;

  @IsOptional()
  @IsBoolean()
  returnTokenForDev?: boolean;
}
