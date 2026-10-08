import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      hsts: process.env.FORCE_HTTPS === 'true' ? undefined : false,
      contentSecurityPolicy:
        process.env.NODE_ENV === 'development' ? false : undefined,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `shipping-backend listening on :${port} (api prefix: /api, docs: /api/docs)`,
  );
}

void bootstrap();
