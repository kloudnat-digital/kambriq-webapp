import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UpdateSettingsDto } from './dto/settings.dto';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';

@Injectable()
export class KbsSettingsService {
  private readonly logger = new Logger(KbsSettingsService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getSettings() {
    const existing = await this.prisma.kbsSettings.findFirst();
    if (existing) return existing;
    return this.prisma.kbsSettings.create({ data: {} });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    if (dto.activeCourseId) {
      const course = await this.prisma.kbsCourse.findUnique({
        where: { id: dto.activeCourseId },
        select: { id: true },
      });
      if (!course) {
        throw new NotFoundException(
          this.t('kbs.course.notFound', undefined, { id: dto.activeCourseId }),
        );
      }
    }

    const current = await this.getSettings();
    const updated = await this.prisma.kbsSettings.update({
      where: { id: current.id },
      data: dto,
    });

    this.logger.log('KBS settings updated', { changed: Object.keys(dto) });
    return updated;
  }

  private t(key: string, lang?: string, args?: Record<string, string | number>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
