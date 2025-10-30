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
} from '@nestjs/common';
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

@UseInterceptors(new TimeoutInterceptor())
@UseGuards(JwtAccessGuard, BusinessAccessGuard, RolesGuard, BusinessPlanGuard)
@Controller('businesses/:businessId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Roles('OWNER', 'MANAGER')
  @Post()
  @ResMessage('Service created')
  async create(
    @Param() param: BusinessIdDto,
    @Body() createServiceDto: CreateServiceDto,
  ) {
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
  ) {
    return await this.servicesService.list(param.businessId, query);
  }

  @Get(':id')
  @ResMessage('Service data')
  async get(@Param() param: BusinessIdDto) {
    return await this.servicesService.findOneForBusiness(
      param.businessId,
      param.id,
    );
  }

  @Roles('OWNER', 'MANAGER')
  @Patch(':id')
  @ResMessage('Service updated')
  async update(@Param() param: BusinessIdDto, @Body() dto: UpdateServiceDto) {
    return await this.servicesService.update(param.businessId, param.id, dto);
  }

  @Roles('OWNER')
  @HttpCode(200)
  @Delete(':id')
  @ResMessage('Service deleted')
  async remove(@Param() param: BusinessIdDto) {
    return this.servicesService.remove(param.businessId, param.id);
  }

  @Post(':id/restore')
  @Roles('OWNER')
  @ResMessage('Service restored')
  async restore(@Param() param: BusinessIdDto) {
    return this.servicesService.restore(param.businessId, param.id);
  }
}
