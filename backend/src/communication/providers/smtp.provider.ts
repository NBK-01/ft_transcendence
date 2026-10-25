import { Injectable, Logger } from '@nestjs/common';
import { isEmail } from 'class-validator';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailProvider } from './email-provider.interface';

export interface SmtpOptions {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * Generic SMTP provider (works against Mailtrap, or any other SMTP relay) —
 * the fallback for deployments that have real SMTP credentials but no
 * SendGrid account. See communication.module.ts for provider selection.
 */
@Injectable()
export class SmtpProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpProvider.name);
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;

  constructor(options: SmtpOptions) {
    this.defaultFrom = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? options.port === 465,
      auth:
        options.user && options.pass
          ? { user: options.user, pass: options.pass }
          : undefined,
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    if (!to || !subject || !html) {
      throw new Error('Missing required email parameters');
    }
    if (!isEmail(to)) {
      throw new Error(`Invalid recipient email address: ${to}`);
    }

    const senderEmail = from ?? this.defaultFrom;
    if (!isEmail(senderEmail)) {
      throw new Error(`Invalid sender email address: ${senderEmail}`);
    }

    try {
      const info = await this.transporter.sendMail({
        to,
        from: senderEmail,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}`, { messageId: info.messageId });
    } catch (error) {
      this.logger.error('Failed to send email via SMTP', {
        to,
        subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
