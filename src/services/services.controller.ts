import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  Query,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { TimeoutInterceptor } from '@app/common/interceptors/timeout.interceptor';
import { QueryServiceDto } from './dto/query-service.dto';
import { PaginationPipe } from '@app/common/pipes/pagination.pipe';
import { JwtAccessGuard } from '@app/auth/guards/jwt-access.guards';
import { BusinessAccessGuard } from '@app/common/guards/business-access.guard';
import { BusinessIdDto } from './dto/params-service.dto';
import { RolesGuard } from '@app/common/guards/roles.guards';
import { Roles } from '@app/common/decorators/roles.decorator';
import { ResMessage, ResPaginated } from '@app/common/http/response.decorator';
import { BusinessPlanGuard } from '@app/auth/guards/business-plan.guard';

import { RateLimitService } from '@app/common/rate-limit/rate-limit.service';
import { RedisKeys } from '@app/cache/redis-keys';
import { UnauthorizedAppError } from '@app/common/errors/specialized.errors';

@UseInterceptors(new TimeoutInterceptor())
@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly rl: RateLimitService,
  ) {}

  private getClientIp(req: Request) {
    const xfwd = (req.headers['x-forwarded-for'] as string) || '';
    const first = xfwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return first || (req.ip ?? req.socket.remoteAddress ?? 'unknown');
  }

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Service created')
  async create(
    @Param() param: BusinessIdDto,
    @Body() createServiceDto: CreateServiceDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const okBiz = await this.rl.hit(
      RedisKeys.rlSvcCreateBiz(param.businessId),
      30,
      60,
    );
    const okIP = await this.rl.hit(
      RedisKeys.rlSvcCreateIP(param.businessId, ip),
      10,
      60,
    );
    if (!okBiz || !okIP)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return await this.servicesService.create(
      param.businessId,
      createServiceDto,
    );
  }

  @Get()
  @ResMessage('Services list')
  @ResPaginated()
  async list(
    @Param() param: BusinessIdDto,
    @Query(new PaginationPipe(100)) query: QueryServiceDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlSvcListIP(param.businessId, ip),
      180,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

    return await this.servicesService.list(param.businessId, query);
  }

  @Get(':id')
  @ResMessage('Service data')
  async get(@Param() param: BusinessIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok = await this.rl.hit(
      RedisKeys.rlSvcGetIP(param.businessId, ip),
      240,
      60,
    );
    if (!ok)
      throw new UnauthorizedAppError('Too many requests. Try again shortly.');

    return await this.servicesService.findOneForBusiness(
      param.businessId,
      param.id,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':id')
  @ResMessage('Service updated')
  async update(
    @Param() param: BusinessIdDto,
    @Body() dto: UpdateServiceDto,
    @Req() req: Request,
  ) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlSvcUpdate(param.businessId, param.id),
      60,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlSvcUpdateIP(param.businessId, param.id, ip),
      30,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return await this.servicesService.update(param.businessId, param.id, dto);
  }

  @Roles('OWNER')
  @HttpCode(200)
  @Delete(':id')
  @ResMessage('Service deleted')
  async remove(@Param() param: BusinessIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlSvcDelete(param.businessId, param.id),
      30,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlSvcDeleteIP(param.businessId, param.id, ip),
      20,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return this.servicesService.remove(param.businessId, param.id);
  }

  @Roles('OWNER')
  @Post(':id/restore')
  @ResMessage('Service restored')
  async restore(@Param() param: BusinessIdDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const ok1 = await this.rl.hit(
      RedisKeys.rlSvcRestore(param.businessId, param.id),
      20,
      60,
    );
    const ok2 = await this.rl.hit(
      RedisKeys.rlSvcRestoreIP(param.businessId, param.id, ip),
      15,
      60,
    );
    if (!ok1 || !ok2)
      throw new UnauthorizedAppError('Too many attempts. Try again shortly.');

    return this.servicesService.restore(param.businessId, param.id);
  }
}
