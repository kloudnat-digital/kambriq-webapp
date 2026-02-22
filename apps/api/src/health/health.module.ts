import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { CoreModule } from '../core/core.module';
import { KbsModule } from '../kbs/kbs.module';

@Module({
  // Import modules that provide the Prisma services used by the controller
  imports: [TerminusModule, CoreModule, KbsModule],
  controllers: [HealthController],
})
export class HealthModule {}
