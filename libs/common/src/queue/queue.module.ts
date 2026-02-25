import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from '../constants/queue';

@Global()
@Module({
  imports: [
    // Default Redis connection for Bull queues
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFailed: 200, // Keep last 200 failed jobs
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: {
            type: 'exponential',
            delay: 5000, // Initial delay of 5 seconds between retries
          },
        },
      }),
    }),

    // Register queues
    BullModule.registerQueue(
      { name: QUEUES.KBS },
      { name: QUEUES.CORE },
      { name: QUEUES.KAMNET },
      { name: QUEUES.NOTIFICATIONS },
    ),
  ],
  // Export BullModule so queues are visible to importing modules (and globally)
  exports: [BullModule],
})
export class QueueModule {}
