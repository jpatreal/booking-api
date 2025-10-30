import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { DRIZZLE } from '@app/db/db.module';
import type { DB } from '@app/db';
import { signupKeys } from '@app/db/schema';
import { sha256Base64, randomToken } from '@app/common/utils/crypto.util';
import { AdminGuard } from './admin.guard';
import { CreateKeysDto } from './dto/create-keys.dto';

@Controller('admin/keys')
@UseGuards(AdminGuard)
export class SignupKeysController {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  @Post()
  async create(
    @Body()
    body: CreateKeysDto,
  ) {
    const raw = randomToken(24);
    const codeHash = sha256Base64(raw);
    const [row] = await this.db
      .insert(signupKeys)
      .values({
        codeHash,
        label: body.label,
        plan: (body.plan ?? 'TRIAL') as any,
        trialDays: body.trialDays ?? 14,
        maxUses: body.maxUses ?? 1,
        emailDomain: body.emailDomain,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();
    return { key: raw, meta: row };
  }

  @Get()
  async list() {
    return this.db.select().from(signupKeys);
  }
}
