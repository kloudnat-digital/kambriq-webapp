import type { Response as ExpressResponse } from 'express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import {
  GlobalExceptionFilter,
  PrismaExceptionFilter,
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

  // ----- Global filters (Order Matters: Most specific first) --------
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

  // ----- Unmatched routes -----
  // Nest's own not-found handler sits outside the global filter chain, so an
  // unmatched URL fell through to Express's default error page: an HTML body
  // carrying the full stack, `/app/node_modules/.pnpm/...` paths and the exact
  // pinned version of every framework package. A wrong URL handed a stranger a
  // dependency inventory.
  //
  // `app.use()` hands the middleware straight to Express, and the router is not
  // mounted until `init()`. Registering this before `init()` would put it ahead
  // of every controller and 404 the entire API, so the explicit `init()` here is
  // load-bearing, not tidiness. `listen()` below is a no-op initialiser once
  // `isInitialized` is set.
  await app.init();
  app.use((req: { originalUrl?: string; url: string }, res: ExpressResponse) => {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: 'Not Found',
      error: 'Not Found',
      timestamp: new Date().toISOString(),
      path: (req.originalUrl ?? req.url).split('?')[0],
    });
  });

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
