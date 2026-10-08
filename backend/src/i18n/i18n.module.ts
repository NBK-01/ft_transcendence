import { Module } from '@nestjs/common';
import { join } from 'path';
import {
  I18nModule as NestI18nModule,
  AcceptLanguageResolver,
} from 'nestjs-i18n';

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname),
        watch: process.env.NODE_ENV === 'development',
      },
      resolvers: [AcceptLanguageResolver],
    }),
  ],
})
export class I18nModule {}
