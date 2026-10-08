import { Inject, Injectable } from '@nestjs/common';
import { EmailProvider } from './providers/email-provider.interface';

/**
 * Email only — the template's SMS/WhatsApp (Twilio) path is deliberately
 * not ported. Nothing in this project sends OTPs or notifications over
 * SMS/WhatsApp yet; add an OtpProvider binding here if/when that changes.
 */
@Injectable()
export class CommunicationService {
  constructor(
    @Inject('EmailProvider') private readonly emailProvider: EmailProvider,
  ) {}

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    from?: string,
  ): Promise<void> {
    return this.emailProvider.sendEmail(to, subject, html, from);
  }
}
