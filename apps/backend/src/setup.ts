import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * The single place where cross-cutting HTTP behaviour is wired, so the running server
 * (main.ts) and every test build the app identically:
 *   - cookies for the httpOnly refresh token (§3.2)
 *   - ValidationPipe whitelist+transform (§3.1)
 *   - the { statusCode, message, code } error envelope (§3.1)
 *   - Swagger UI at /docs and the machine-readable spec at /docs-json
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PawLink API')
    .setDescription(
      'Animal rescue, care and adoption platform for Algeria. ' +
        'The frontend generates its typed client from this document, so response shapes must ' +
        'match apps/web/lib/types.ts field-for-field (see docs/TEAM_HANDOFF.md).',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const httpAdapter = app.getHttpAdapter();

  // Serve the spec as JSON (the frontend generates its typed client from this).
  httpAdapter.get('/docs-json', (_req: Request, res: Response) => res.json(document));

  // Swagger UI loaded from a CDN so it works on serverless hosts (Vercel) where
  // the swagger-ui-dist assets shipped in node_modules are not served.
  httpAdapter.get('/docs', (_req: Request, res: Response) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PawLink API — /docs-json for the machine-readable spec</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/docs-json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`);
  });

  return app;
}
