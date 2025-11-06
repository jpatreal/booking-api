import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { QueryAuditDto } from './dto/query-audit.dto';
import { AuditLogQueryService } from './audit-log-query.service';
import { Response } from 'express';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly svc: AuditLogQueryService) {}

  @Get()
  async list(@Query() q: QueryAuditDto) {
    return this.svc.list(q);
  }

  @Get('export')
  async export(@Query() q: QueryAuditDto, @Res() res: Response) {
    const format = (q.format ?? 'csv').toLowerCase();
    const filename = `audit-logs.${format}`;
    const contentType =
      format === 'ndjson' ? 'application/x-ndjson' : 'text/csv';

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = this.svc.streamExport(q);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res
          .status(500)
          .setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(
        JSON.stringify({
          error: 'export_failed',
          message: String(err?.message ?? err),
        }),
      );
    });
    stream.pipe(res);
  }
}
