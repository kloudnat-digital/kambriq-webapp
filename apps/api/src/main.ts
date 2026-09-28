import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { text } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import {
  GlobalExceptionFilter,
  PrismaExceptionFilter,
  robotsHeaderMiddleware,
  TransformResponseInterceptor,
  ZodExceptionFilter,
  servesApiDocs,
} from '@kambriq/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer untill Pino Logger is ready
    // Keeps the unparsed body on `req.rawBody`, which `SanityWebhookGuard` needs:
    // the webhook signature is an HMAC over the bytes received, and re-encoding
    // the parsed body does not reproduce them. It holds a reference to the buffer
    // body-parser already allocated, so it costs no extra memory.
    rawBody: true,
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

  // ----- SNS deliveries (C24) -----
  // SNS posts `Content-Type: text/plain`, which the JSON and urlencoded parsers
  // leave unread. The SES events endpoint verifies the signature over fields of
  // the parsed JSON, not the bytes, so a string body is all it needs.
  app.use(text({ type: 'text/plain', limit: '256kb' }));

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
  // always terminates in a JSON envelope. It delegates rather than rethrows: a
  // rethrow from a filter escapes Nest entirely into Express's default error
  // page.
  app.useGlobalFilters(
    new GlobalExceptionFilter(), // Catch-all (last resort)
    new PrismaExceptionFilter(), // Prisma Errors → HTTP codes
    new ZodExceptionFilter(), // Zod Validation Errors → 400 Bad Request
  );

  // ----- Global Interceptors ----------
  app.useGlobalInterceptors(new TransformResponseInterceptor()); // Wrap responses in a consistent format

  // ----- Swagger ----------
  // A43: only where APP_ENV declares a local environment - never on dev, whose
  // NODE_ENV=development is exactly a laptop's. See libs/common/src/config/api-docs.ts.
  if (servesApiDocs(process.env)) {
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
  if (servesApiDocs(process.env)) {
    logger.log(`📖 Swagger docs: http://localhost:${port}/${prefix}/docs`);
  }
}

bootstrap();
