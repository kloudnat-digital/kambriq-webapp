import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import {
  CorrelationIdMiddleware,
  DEFAULT_LANGUAGE,
  EmailModule,
  JwtAuthGuard,
  QueueModule,
  RedisModule,
  RolesGuard,
  UserLanguageResolver,
  validateEnv,
} from '@kambriq/common';
import { AcceptLanguageResolver, HeaderResolver, I18nModule } from 'nestjs-i18n';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage } from 'http';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from '../core/core.module';
import { HealthModule } from '../health/health.module';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { KbsModule } from '../kbs/kbs.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KamnetModule } from '../kamnet/kamnet.module';
import { LandsModule } from '../lands/lands.module';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [
    // ----- Config -----
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),

    // ----- i18n -----
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LANGUAGE,
      loaderOptions: {
        path: path.join(process.cwd(), 'libs/common/src/i18n'),
        watch: true,
      },
      resolvers: [new HeaderResolver(['x-lang']), UserLanguageResolver, AcceptLanguageResolver],
    }),

    // ----- Logging (Pino) -----
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                    singleLine: true,
                  },
                }
              : undefined,
          autoLogging: true,
          customProps: (req: IncomingMessage) => {
            const header = req.headers['x-correlation-id'];
            const correlationId = Array.isArray(header) ? header[0] : header;
            return { correlationId };
          },
        },
      }),
    }),

    // ----- Rate Limiting -----
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 6000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // ----- Domain Modules -----
    CoreModule,
    KbsModule,
    KamnetModule,
    LandsModule,
    NewsletterModule,
    HealthModule,

    // Infrastructure Modules
    QueueModule,
    EmailModule,
    RedisModule,
  ],

  providers: [
    UserLanguageResolver,
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: ThrottlerGuard },
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
