import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const production = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // One JSON object per line in production, which log tools can search
    logger: new ConsoleLogger({ json: production, colors: !production }),
  });

  // Behind Railway's proxy: take the client's IP from X-Forwarded-For, so
  // rate limits apply per caller rather than to the proxy
  app.set('trust proxy', 1);

  // Meal photos are sent as base64 JSON, so allow a few MB (Express's
  // default is 100 kB)
  app.useBodyParser('json', { limit: '5mb' });

  // CORS only matters for the web build. CORS_ORIGINS (comma-separated)
  // narrows it; unset, any origin is allowed as before.
  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    credentials: true,
  });

  // Every request body and query is a DTO class: unknown fields are rejected
  // and wrong types return 400 instead of reaching the database.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // On SIGTERM (a deploy or restart), finish in-flight requests and close the
  // database connections before exiting
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`GRIT backend running on port ${port}`);
}
void bootstrap();
