import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationService } from './communication.service';
import { SendGridProvider } from './providers/sendgrid.provider';
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

        if (
          configService.get<string>('NODE_ENV') === 'production' &&
          (!apiKey || !fromEmail)
        ) {
          throw new Error(
            'SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are required in production',
          );
        }

        return apiKey && fromEmail
          ? new SendGridProvider(apiKey, fromEmail)
          : new ConsoleEmailProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [CommunicationService],
})
export class CommunicationModule {}
