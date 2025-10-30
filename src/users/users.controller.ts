import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    return await this.users.findById(id);
  }

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = takeRaw ? parseInt(takeRaw, 10) : 25;
    return await this.users.list({ q, cursor: cursor ?? null, take });
  }

  @Post()
  async create(@Body() body: CreateUserDto) {
    const user = await this.users.create({
      email: body.email,
      password: body.password,
    });
    return user;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const user = await this.users.update(id, {
      email: body.email,
      password: body.password,
    });
    return user;
  }
}
