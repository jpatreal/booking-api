import { Exclude, Expose, Transform } from 'class-transformer';

@Expose()
export class ServiceEntity {
  @Expose() id!: string;
  @Expose() businessId!: string;
  @Expose() name!: string;
  @Expose() durationMin!: number;

  @Expose()
  @Transform(({ value }) => value?.toString())
  price!: string;

  @Expose() active!: boolean;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;

  @Exclude() deletedAt?: Date | null;

  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}
