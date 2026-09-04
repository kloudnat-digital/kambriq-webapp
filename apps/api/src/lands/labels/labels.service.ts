import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LandsPrismaService } from '../prisma/lands-prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateLabelDto, UpdateLabelDto } from '../dto/lands.dto';
import { LandLabelCodes } from '@kambriq/common';

@Injectable()
export class LandsLabelsService {
  private readonly logger = new Logger(LandsLabelsService.name);

  constructor(
    private readonly prisma: LandsPrismaService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Create Land Labels ----- //
  async create(dto: CreateLabelDto) {
    const existing = await this.prisma.landLabel.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(this.t('lands.label.codeTaken', undefined, { code: dto.code }));
    }

    const label = await this.prisma.landLabel.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
      },
    });

    this.logger.log('Land label created %o', {
      labelId: label.id,
      code: label.code,
    });

    return label;
  }

  // ----- Update Land Labels ----- //
  async update(labelId: string, dto: UpdateLabelDto) {
    const label = await this.findByIdOrThrow(labelId);

    const updated = await this.prisma.landLabel.update({
      where: { id: labelId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    this.logger.log('Land label updated %o', {
      labelId: label.id,
      code: label.code,
    });

    return updated;
  }

  // ----- Delete Land Labels ----- //
  async delete(labelId: string) {
    const label = await this.findByIdOrThrow(labelId);

    const landCount = await this.prisma.land.count({
      where: { labelId },
    });

    if (landCount > 0) {
      throw new ConflictException(this.t('lands.label.inUse', undefined, { count: landCount }));
    }

    await this.prisma.landLabel.delete({
      where: { id: labelId },
    });

    this.logger.log('Land label deleted %o', {
      labelId: label.id,
      code: label.code,
    });
  }

  // ----- List All Labels ----- //
  async findAll() {
    return this.prisma.landLabel.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { lands: true } } },
    });
  }

  // ----- Find Label By Code ----- //
  async findByCode(code: LandLabelCodes) {
    const label = await this.prisma.landLabel.findUnique({
      where: { code },
    });
    if (!label) {
      throw new NotFoundException(this.t('lands.label.notFound'));
    }
    return label;
  }

  // ----- Private Helpers -----
  private async findByIdOrThrow(labelId: string) {
    const label = await this.prisma.landLabel.findUnique({
      where: { id: labelId },
    });
    if (!label) {
      throw new NotFoundException(this.t('lands.label.notFound'));
    }
    return label;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
