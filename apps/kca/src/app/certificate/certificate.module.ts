import { Module } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { PrismaModule } from '@kambriq/db';

@Module({
  imports: [PrismaModule],
  controllers: [CertificateController],
  providers: [CertificateService],
})
export class CertificateModule {}
