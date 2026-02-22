import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
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

  // ----- CORS --------------
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ];
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
      .addTag('Health', 'Health Checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

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
