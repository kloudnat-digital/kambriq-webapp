import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { prismaLogLevels } from '@kambriq/common';
import { PrismaClient } from '@kambriq/common/prisma/core-client/client';

@Injectable()
export class CorePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CorePrismaService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL_CORE');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({
      // A48: SQL is logged only where APP_ENV=local - never on dev.
      log: prismaLogLevels(),
      adapter,
    });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Core database connected');
    } catch (error) {
      this.logger.error('Core database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      await this.pool.end();
      this.logger.log('Core database disconnected');
    } catch (error) {
      this.logger.error('Core database disconnection failed', error);
    }
  }
}
