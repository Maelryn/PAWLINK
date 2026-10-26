/**
 * Swagger completeness gate.
 *
 * Boots the app, builds the OpenAPI document, and fails when anything in it is
 * undocumented:
 *
 *   - a schema with no `description`          (the DTO itself is unexplained)
 *   - a schema property with no `description`  (the field is a mystery to the client)
 *   - a parameter with no `description`        (the query/path param is a mystery)
 *
 * This exists because the frontend generates its typed client from `/docs-json`:
 * a field with no description is a field the frontend developer cannot use
 * correctly. Phase 4 of `docs/BACKEND_PROMPT.md` asks for "Swagger completeness
 * (every schema documented)" — this is the gate that keeps it true.
 *
 *   npm run docs:check
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

/** A property that is fully described by its type alone needs no prose. */
function isSelfDescribing(property: Record<string, unknown>): boolean {
  return Boolean(property.$ref || property.allOf || property.enum || property.oneOf || property.anyOf);
}

/** A `$ref` carries its own documentation in the referenced schema. */
function isReference(value: SchemaObject | ReferenceObject): value is ReferenceObject {
  return '$ref' in value;
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('pawlink').build(),
  );

  const problems: string[] = [];
  let schemaCount = 0;
  let propertyCount = 0;
  let parameterCount = 0;

  for (const [name, entry] of Object.entries(doc.components?.schemas ?? {})) {
    if (isReference(entry)) continue;
    const schema = entry as SchemaObject;
    schemaCount++;
    if (!schema.description) problems.push(`schema ${name} has no description`);

    for (const [property, definition] of Object.entries(schema.properties ?? {})) {
      propertyCount++;
      const prop = definition as Record<string, unknown>;
      if (!prop.description && !isSelfDescribing(prop)) {
        problems.push(`schema ${name}.${property} has no description`);
      }
    }
  }

  for (const [path, operations] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      for (const parameter of operation.parameters ?? []) {
        parameterCount++;
        if (!parameter.description) {
          problems.push(`${method.toUpperCase()} ${path} ?${parameter.name} has no description`);
        }
      }
    }
  }

  await app.close();

  const operationCount = Object.values(doc.paths).reduce(
    (total, operations) => total + Object.keys(operations).length,
    0,
  );

  console.log(
    `Swagger: ${operationCount} operations · ${schemaCount} schemas · ` +
      `${propertyCount} properties · ${parameterCount} parameters`,
  );

  if (problems.length > 0) {
    console.error(`\n${problems.length} undocumented item(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nEvery schema, property and parameter needs a description.');
    process.exitCode = 1;
    return;
  }

  console.log('Every schema, property and parameter is documented.');
}

void main();
