import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class PaginationPipe implements PipeTransform {
  constructor(private readonly maxPageSize = 100) {}
  transform(value: any) {
    const page = Math.max(1, parseInt(value?.page ?? '1', 10) || 1);
    const pageSizeRaw = parseInt(value?.pageSize ?? '20', 10) || 20;
    const pageSize = Math.min(this.maxPageSize, Math.max(1, pageSizeRaw));
    if (page < 1) throw new BadRequestException('page must be >= 1');
    if (pageSize < 1) throw new BadRequestException('pageSize must be >= 1');
    return { ...value, page, pageSize };
  }
}
