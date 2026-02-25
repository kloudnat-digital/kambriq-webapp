import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import { KbsCertificatesService } from './certificates.service';

/**
 * Lightweight module that exposes only KbsCertificatesService.
 * Imported by KamnetModule to validate KCA certificates without
 * pulling in the full KbsModule (courses, exams, candidates, etc.).
 */
@Module({
  imports: [CoreModule],
  providers: [KbsPrismaService, KbsCertificatesService],
  exports: [KbsCertificatesService],
})
export class KbsCertificatesModule {}
