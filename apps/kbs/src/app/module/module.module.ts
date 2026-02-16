import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { PrismaModule } from '@kambriq/db';

@Module({
  imports: [PrismaModule],
  providers: [ModuleService],
  controllers: [ModuleController],
  exports: [ModuleService],
})
export class ModuleModule {}
