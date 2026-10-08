import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import { randomBytes } from 'crypto';

const DOCS_PATH = 'api/docs';

export function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV !== 'development') {
    configureSwaggerAuth(app);
  }

  const config = new DocumentBuilder()
    .setTitle('Shipping Backend API')
    .setDescription('Shipping Ops Platform')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

function configureSwaggerAuth(app: INestApplication): void {
  const user = process.env.SWAGGER_USER;
  const password =
    process.env.SWAGGER_PASSWORD || randomBytes(12).toString('hex');

  if (!process.env.SWAGGER_PASSWORD) {
    console.warn(
      `SWAGGER_PASSWORD not set — generated for this run: ${password}`,
    );
  }

  app.use(
    `/${DOCS_PATH}`,
    basicAuth({
      challenge: true,
      users: { [user || 'admin']: password },
    }),
  );
}
