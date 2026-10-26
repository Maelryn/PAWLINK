import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // §3.1 + §3.2: cookies, validation, error envelope, Swagger — shared with tests via setup.ts
  configureApp(app);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`PawLink API → http://localhost:${port}  ·  Swagger → http://localhost:${port}/docs`);
}

void bootstrap();
