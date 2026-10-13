/**
 * Dev-only gate helper: boot the app, build the Swagger document, and print
 * every documented operation. Used by the Phase 3 report to prove `/docs`
 * covers the whole route surface. Never shipped — not referenced by any code.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('pawlink').build(),
  );

  const methods: string[] = [];
  for (const [path, operations] of Object.entries(doc.paths)) {
    for (const method of Object.keys(operations)) {
      methods.push(`${method.toUpperCase()} ${path}`);
    }
  }
  methods.sort();

  const phase3 = methods.filter((m) =>
    /adoptions|requests|services|bookings|emergency-zones|(^| )\/me\//.test(m),
  );
  console.log(`TOTAL ${methods.length}`);
  console.log(`PHASE3 ${phase3.length}`);
  for (const m of phase3) console.log(m);

  await app.close();
}

void main();
