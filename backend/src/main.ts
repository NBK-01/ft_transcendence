import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { RedisIoAdapter } from './chat/redis-io.adapter';

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
      // Preserve the raw ValidationError[] (with per-constraint detail) instead of
      // flattening to a string[] — GlobalExceptionFilter translates each constraint
      // individually (errors.VALIDATION_MINLENGTH, etc.) instead of surfacing
      // class-validator's untranslated English default messages.
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          message: errors,
          error: 'Bad Request',
        }),
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

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `shipping-backend listening on :${port} (api prefix: /api, docs: /api/docs)`,
  );
}

void bootstrap();
