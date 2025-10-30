import { Exclude, Expose } from 'class-transformer';

export class BasePublicDto {
  @Expose() id: string;

  @Expose() createdAt?: Date;
  @Expose() updatedAt?: Date;

  @Exclude() deletedAt?: Date;

  constructor(partial: Partial<BasePublicDto>) {
    Object.assign(this, partial);
  }
}
