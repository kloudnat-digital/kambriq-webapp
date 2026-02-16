import { Injectable } from '@nestjs/common';
import { PrismaService } from '@kambriq/db';
import { KCACertificateStatus } from '@kambriq/shared';
import { CreateCertificateDto } from './dto/create-certificat-dto';
import { UpdateCertificateDto } from './dto/update-certificate-dto';

@Injectable()
export class CertificateService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCertificateDto) {
    return this.prisma.kCACertificate.create({
      data: dto,
    });
  }

  findAll() {
    return this.prisma.kCACertificate.findMany();
  }

  findOne(id: string) {
    return this.prisma.kCACertificate.findUnique({ where: { id } });
  }

  findByCandidateId(candidateId: string) {
    return this.prisma.kCACertificate.findUnique({
      where: { candidateId },
    });
  }

  update(id: string, dto: UpdateCertificateDto) {
    return this.prisma.kCACertificate.update({ where: { id }, data: dto });
  }

  revoke(id: string) {
    return this.prisma.kCACertificate.update({
      where: { id },
      data: {
        status: KCACertificateStatus.REVOKED,
      },
    });
  }

  delete(id: string) {
    return this.prisma.kCACertificate.delete({ where: { id } });
  }
}
