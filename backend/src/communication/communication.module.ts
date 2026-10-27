import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationService } from './communication.service';
import { SendGridProvider } from './providers/sendgrid.provider';
import { SmtpProvider } from './providers/smtp.provider';
import { ConsoleEmailProvider } from './providers/console.provider';

@Global()
@Module({
  providers: [
    CommunicationService,
    {
      provide: 'EmailProvider',
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('SENDGRID_API_KEY');
        const fromEmail = configService.get<string>('SENDGRID_FROM_EMAIL');

        const smtpHost = configService.get<string>('SMTP_HOST');
        const smtpPort = configService.get<string>('SMTP_PORT');
        const smtpFromEmail = configService.get<string>('SMTP_FROM_EMAIL');

        const hasSendGrid = Boolean(apiKey && fromEmail);

        // Neither configured, even in production: log instead of refusing to
        // boot — real mail delivery is an operational concern, not one that
        // should take the whole API down (e.g. a fresh Docker/eval run).
        if (hasSendGrid) {
          return new SendGridProvider(apiKey as string, fromEmail as string);
        }
        if (smtpHost && smtpPort && smtpFromEmail) {
          return new SmtpProvider({
            host: smtpHost,
            port: Number(smtpPort),
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASSWORD'),
            from: smtpFromEmail,
          });
        }
        return new ConsoleEmailProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [CommunicationService],
})
export class CommunicationModule {}
