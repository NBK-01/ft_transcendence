import { Injectable, Logger } from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { EmailProvider } from './email-provider.interface';

const SEND_URL = 'https://send.api.mailtrap.io/api/send';

/**
 * Mailtrap's HTTP Send API — not SMTP. Railway (like several PaaS platforms)
 * blocks outbound traffic on SMTP ports (587/2525 both hang/time out from
 * inside the container, confirmed against the same Mailtrap account that
 * works instantly over SMTP from outside Railway), so this talks to Mailtrap
 * over plain HTTPS instead, which isn't port-restricted.
 */
@Injectable()
export class MailtrapProvider implements EmailProvider {
  private readonly logger = new Logger(MailtrapProvider.name);

  constructor(
    private readonly apiToken: string,
    private readonly defaultFrom: string,
  ) {}

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
      const response = await fetch(SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: senderEmail },
          to: [{ email: to }],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Mailtrap API responded ${response.status}: ${body}`);
      }

      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error('Failed to send email via Mailtrap', {
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
