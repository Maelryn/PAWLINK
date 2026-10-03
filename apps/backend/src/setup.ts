import type { INestApplication } from '@nestjs/common';
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
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'PawLink API — /docs-json for the machine-readable spec',
  });

  return app;
}
