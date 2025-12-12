import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateKeysDto } from './dto/create-keys.dto';
import { businessIdParam, RenewPlanDto } from './dto/renew-plan.dto';
import { ResMessage } from '@app/common/http/response.decorator';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('keys')
  @ResMessage('Sign up key created successfully')
  async createKey(@Body() body: CreateKeysDto) {
    return this.admin.createSignupKey(body);
  }

  @Get('keys')
  @ResMessage('Keys list')
  async listKeys() {
    return this.admin.listSignupKeys();
  }

  @Get('businesses')
  @ResMessage('Business list')
  async listBusinessesWithOwner() {
    return this.admin.listBusinessesWithOwner();
  }

  @Patch('businesses/:businessId/plan/renew')
  @ResMessage('Business plan renewed successfully')
  async renewPlan(@Param() param: businessIdParam, @Body() body: RenewPlanDto) {
    return this.admin.renewPlanForBusiness(param.businessId, body);
  }

  @Patch('businesses/:businessId/plan/suspend')
  @ResMessage('Business plan suspended')
  async suspendPlan(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
  ) {
    const updated = await this.admin.suspendBusinessPlan(businessId);
    return updated;
  }
}
