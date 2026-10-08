import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider } from './email-provider.interface';

/**
 * Not in the source template — added so local dev doesn't require a real
 * SendGrid account just to exercise registration/OTP/password-reset flows.
 * Logs the email instead of sending it. Picked automatically when
 * SENDGRID_API_KEY is unset; never used when NODE_ENV=production (see
 * communication.module.ts).
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('ConsoleEmailProvider (dev)');

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    this.logger.log(
      `\n--- EMAIL ---\nTo: ${to}\nFrom: ${from ?? '(default)'}\nSubject: ${subject}\n${html}\n-------------`,
    );
  }
}
