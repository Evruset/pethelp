import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

async function main(): Promise<void> {
  // Export is metadata-only: never run timers or require production secrets.
  process.env.WORKERS_ENABLED = 'false';
  process.env.JWT_SECRET ??= 'openapi-export-only-jwt-secret';
  process.env.JWT_ISSUER ??= 'vethelp-openapi-export';
  process.env.JWT_AUDIENCE ??= 'vethelp-openapi-export';
  process.env.WORKER_SERVICE_TOKEN ??= 'openapi-export-only-worker-token';

  const [{ NestFactory }, { NestRoot }, { createOpenApiDocument }] = await Promise.all([
    import('@nestjs/core'),
    import('../src/nest-root-full'),
    import('../src/openapi/openapi'),
  ]);

  const app = await NestFactory.create(NestRoot, { logger: false });
  try {
    const document = createOpenApiDocument(app);
    const output = resolve(
      process.cwd(),
      process.env.OPENAPI_OUTPUT ?? 'artifacts/openapi/swagger.json',
    );

    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    console.log(`OpenAPI exported to ${output}`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
