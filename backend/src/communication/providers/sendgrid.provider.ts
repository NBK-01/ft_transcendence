import * as sgMail from '@sendgrid/mail';
import { Injectable, Logger } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { EmailProvider } from './email-provider.interface';

@Injectable()
export class SendGridProvider implements EmailProvider {
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {
    sgMail.setApiKey(apiKey);
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
      const response = await sgMail.send({
        to,
        from: senderEmail,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}`, {
        statusCode: response[0]?.statusCode,
      });
    } catch (error) {
      this.logger.error('Failed to send email via SendGrid', {
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
