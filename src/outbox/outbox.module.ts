import { Module } from '@nestjs/common';
import { Cron, ScheduleModule } from '@nestjs/schedule';
import { OutboxDispatcher } from './outbox.dispatcher';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OutboxDispatcher],
})
export class OutboxModule {
  constructor(private readonly d: OutboxDispatcher) {}
  @Cron('*/5 * * * * *') async run() {
    await this.d.tick(50);
  }
}
