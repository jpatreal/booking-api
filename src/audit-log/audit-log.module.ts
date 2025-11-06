import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryService } from './audit-log-query.service';
import { AuditLogController } from './audit-log.controller';

@Global()
@Module({
  providers: [AuditLogService, AuditLogQueryService],
  exports: [AuditLogService],
  controllers: [AuditLogController],
})
export class AuditLogModule {}
