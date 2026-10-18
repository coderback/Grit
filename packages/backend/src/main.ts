import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true, // tighten in production
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

  await app.listen(process.env.PORT ?? 3000);
  console.log(`GRIT backend running on port ${process.env.PORT ?? 3000}`);
}
void bootstrap();
