import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { QueueHealthService } from './queue-health.service';
import { CoreModule } from '../core/core.module';
import { KbsModule } from '../kbs/kbs.module';

@Module({
  // Imports modules providing Prisma services used by the controller.
  imports: [TerminusModule, CoreModule, KbsModule],
  controllers: [HealthController],
  // Queues are provided by the global QueueModule, which exports BullModule.
  providers: [QueueHealthService],
})
export class HealthModule {}
