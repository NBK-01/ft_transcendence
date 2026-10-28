import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import { randomBytes } from 'crypto';

const DOCS_PATH = 'api/docs';
const PUBLIC_DOCS_PATH = 'api/public-docs';
/** Tag every Public API controller carries — see PartnerController/PartnerShipmentsController. */
const PUBLIC_API_TAG = 'Public API';

export function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV !== 'development') {
    configureSwaggerAuth(app);
  }

  const config = new DocumentBuilder()
    .setTitle('Shipping Backend API')
    .setDescription('Shipping Ops Platform')
    .setVersion('0.0.1')
    .addBearerAuth()
    // The public API's routes (/api/v1/*) take a partner API key instead of a login token.
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Partner API key (stk_…), for the Public API routes',
      },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  setupPublicApiDocs(app, document);
}

/**
 * Partner-facing subset of the same document, filtered down to the
 * `Public API` tag — no admin-only routes (ApiKeysController lives in the
 * same module but isn't tagged here), no bearer auth, no basic auth: this
 * is meant to be shared with partner developers directly.
 */
function setupPublicApiDocs(
  app: INestApplication,
  fullDocument: OpenAPIObject,
): void {
  const paths = Object.fromEntries(
    Object.entries(fullDocument.paths).flatMap(([path, methods]) => {
      const filtered = Object.fromEntries(
        Object.entries(methods).filter(([, operation]) =>
          (operation as { tags?: string[] }).tags?.includes(PUBLIC_API_TAG),
        ),
      );
      return Object.keys(filtered).length > 0 ? [[path, filtered]] : [];
    }),
  );

  const apiKeyScheme = fullDocument.components?.securitySchemes?.['api-key'];

  const publicDocument: OpenAPIObject = {
    ...fullDocument,
    info: {
      ...fullDocument.info,
      title: 'Shipping Public API',
      description:
        'Partner-facing routes under /api/v1 — list/create/track shipments with an API key.',
    },
    paths,
    tags: fullDocument.tags?.filter((tag) => tag.name === PUBLIC_API_TAG),
    components: {
      ...fullDocument.components,
      securitySchemes: apiKeyScheme ? { 'api-key': apiKeyScheme } : undefined,
    },
  };

  SwaggerModule.setup(PUBLIC_DOCS_PATH, app, publicDocument, {
    customSiteTitle: 'Shipping Public API',
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

  // SwaggerModule also serves the raw spec at these two sibling paths —
  // neither is a sub-path of DOCS_PATH, so each needs its own mount.
  app.use(
    [`/${DOCS_PATH}`, `/${DOCS_PATH}-json`, `/${DOCS_PATH}-yaml`],
    basicAuth({
      challenge: true,
      users: { [user || 'admin']: password },
    }),
  );
}
