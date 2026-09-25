import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@kambriq/common/prisma/lands-client/client';

@Injectable()
export class LandsPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LandsPrismaService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL_LANDS');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
      adapter,
    });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('LANDS database connected');
    } catch (error) {
      this.logger.error('LANDS database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      await this.pool.end();
      this.logger.log('LANDS database disconnected');
    } catch (error) {
      this.logger.error('LANDS database disconnection failed', error);
    }
  }
}
