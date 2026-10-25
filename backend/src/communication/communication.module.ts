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
        const hasSmtp = Boolean(smtpHost && smtpPort && smtpFromEmail);

        if (
          configService.get<string>('NODE_ENV') === 'production' &&
          !hasSendGrid &&
          !hasSmtp
        ) {
          throw new Error(
            'Either SENDGRID_API_KEY/SENDGRID_FROM_EMAIL or SMTP_HOST/SMTP_PORT/SMTP_FROM_EMAIL are required in production',
          );
        }

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
