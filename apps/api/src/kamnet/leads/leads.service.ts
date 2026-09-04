import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { I18nService } from 'nestjs-i18n';
import {
  KAMNET_VALID_LEAD_TRANSITIONS,
  KamnetLeadStatus,
  PaginationQuery,
  buildPaginatedResponse,
  changedKeys,
} from '@kambriq/common';
import { CreateLeadDto, LeadFilterDto, UpdateLeadDto } from '../dto/kamnet.dto';

@Injectable()
export class KamnetLeadsService {
  private readonly logger = new Logger(KamnetLeadsService.name);

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Create Lead ----- //
  async create(agentId: string, dto: CreateLeadDto) {
    const lead = await this.prisma.kamnetLead.create({
      data: {
        agentId,
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        clientPhone: dto.clientPhone,
        source: dto.source,
        notes: dto.notes,
        status: KamnetLeadStatus.NEW,
      },
    });

    this.logger.log('Lead created %o', { agentId, leadId: lead.id });

    return lead;
  }

  // ----- Update Lead ----- //
  async update(leadId: string, agentId: string, dto: UpdateLeadDto) {
    const lead = await this.findByIdAndOwner(leadId, agentId);

    if (dto.status && dto.status !== lead.status) {
      const allowed = KAMNET_VALID_LEAD_TRANSITIONS[lead.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          this.t('kamnet.lead.invalidTransition', undefined, {
            from: lead.status,
            to: dto.status,
          }),
        );
      }

      const updated = await this.prisma.kamnetLead.update({
        where: { id: leadId },
        data: {
          ...(dto.clientName !== undefined && { clientName: dto.clientName }),
          ...(dto.clientEmail !== undefined && {
            clientEmail: dto.clientEmail,
          }),
          ...(dto.clientPhone !== undefined && {
            clientPhone: dto.clientPhone,
          }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.status === KamnetLeadStatus.CONVERTED && {
            convertedAt: new Date(),
          }),
        },
      });

      // A lead DTO carries clientName, clientEmail and clientPhone.
      this.logger.log('Lead updated %o', { leadId, changed: changedKeys(dto) });
      return updated;
    }
  }

  // ----- Delete Lead ----- //
  async delete(leadId: string, agentId: string) {
    await this.findByIdAndOwner(leadId, agentId);

    await this.prisma.kamnetLead.update({
      where: { id: leadId },
      data: {
        deletedAt: new Date(),
        deletedBy: agentId,
      },
    });

    this.logger.log('Lead soft-deleted %o', { leadId, agentId });
  }

  // ----- Get My Leads ----- //
  async findMyLeads(agentId: string, query: PaginationQuery, filters?: LeadFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { agentId, deletedAt: null };
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { clientName: { contains: filters.search, mode: 'insensitive' } },
        { clientEmail: { contains: filters.search, mode: 'insensitive' } },
        { clientPhone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await this.prisma.$transaction([
      this.prisma.kamnetLead.findMany({
        skip,
        where,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
      }),
      this.prisma.kamnetLead.count({ where }),
    ]);

    return buildPaginatedResponse(leads, total, page, limit);
  }

  // ----- Get Lead By ID ----- //
  async findOne(leadId: string, agentId: string) {
    return this.findByIdAndOwner(leadId, agentId);
  }

  // ----- Private Helpers -----//
  private async findByIdAndOwner(leadId: string, agentId: string) {
    const lead = await this.prisma.kamnetLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(this.t('kamnet.lead.notFound'));
    }

    if (lead.agentId !== agentId) {
      throw new ForbiddenException(this.t('kamnet.lead.notOwner'));
    }

    return lead;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
