import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import {
  GlobalExceptionFilter,
  PrismaExceptionFilter,
  robotsHeaderMiddleware,
  TransformResponseInterceptor,
  ZodExceptionFilter,
} from '@kambriq/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer untill Pino Logger is ready
  });

  // ----- Logger ------------
  app.useLogger(app.get(Logger));

  // ----- Security ----------
  app.use(helmet());

  // ----- Indexing (P4) ------
  // X-Robots-Tag: noindex outside production, from APP_ENV - the same rule the
  // web applies, so the whole hostname answers one way. Middleware, before
  // routing, so a 404 and a 401 carry it too; an interceptor would miss both.
  app.use(robotsHeaderMiddleware());

  // ----- Cookie Parser -----
  // Parses Cookie header and populates req.cookies so NestJS can read httpOnly tokens
  app.use(cookieParser());

  // ----- CORS --------------
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // ----- Global Prefix -------
  const prefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(prefix);

  // ----- Global filters --------
  // Nest tries the LAST-registered matching filter first, so this list reads
  // catch-all first, most specific last. Both `GlobalExceptionFilter` and
  // `PrismaExceptionFilter` are `@Catch()`; `PrismaExceptionFilter` delegates
  // to the global one for anything that is not a Prisma error, so the chain
  // always terminates in a JSON envelope. It used to rethrow, and a rethrow
  // from a filter escapes Nest entirely into Express's default error page.
  app.useGlobalFilters(
    new GlobalExceptionFilter(), // Catch-all (last resort)
    new PrismaExceptionFilter(), // Prisma Errors → HTTP codes
    new ZodExceptionFilter(), // Zod Validation Errors → 400 Bad Request
  );

  // ----- Global Interceptors ----------
  app.useGlobalInterceptors(new TransformResponseInterceptor()); // Wrap responses in a consistent format

  // ----- Swagger ----------
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('KAMBRIQ API')
      .setDescription('KAMBRIQ Platform Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication & Registration')
      .addTag('Users', 'User Management')
      .addTag('KBS - Candidate', 'KBS Training & Exams')
      .addTag('KBS - Admin', 'KBS Content & Candidate Management')
      .addTag('KBS - Public', 'KCA Certificate Verification')
      .addTag('KAMNET - Agent', 'Agent Dashboard, Leads, Reservations, Network')
      .addTag('KAMNET - Admin', 'Agent Management, Applications, Commissions')
      .addTag('LANDS - Agent', 'Browse Lands, Reserve for Clients')
      .addTag('LANDS - Admin', 'Land CRUD, Labels, Media, Documents, Reservations')
      .addTag('Health', 'Health Checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

  // ----- Graceful Shutdown -----
  // Enables NestJS to intercept SIGTERM and call OnModuleDestroy hooks
  // (e.g. Prisma $disconnect) before the container exits.
  app.enableShutdownHooks();

  // ----- Start Server ----------
  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 KAMBRIQ API running on http://localhost:${port}/${prefix}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📖 Swagger docs: http://localhost:${port}/${prefix}/docs`);
  }
}

bootstrap();
