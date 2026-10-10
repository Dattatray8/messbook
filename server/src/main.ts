import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { auth } from './auth/better-auth';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  // Body parsing is disabled so Better Auth can read the raw request on /api/auth/*.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.enableCors({ origin: true, credentials: true });

  // Better Auth must be mounted BEFORE the JSON body parser.
  app
    .getHttpAdapter()
    .getInstance()
    .all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
