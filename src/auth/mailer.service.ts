import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')!;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const secure =
      String(this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER')!;
    const pass = (this.config.get<string>('SMTP_PASS') ?? '').replace(
      /\s+/g,
      '',
    );
    this.from = this.config.get<string>('MAIL_FROM') ?? user;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.verify();

      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email: ${err.message}`);
      throw err;
    }
  }
}
