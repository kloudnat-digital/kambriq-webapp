import { I18nService } from 'nestjs-i18n';
import slugify from 'slugify';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CreateLandDto,
  UpdateLandDto,
  LandFilterDto,
  AddMediaDto,
  AddDocumentDto,
  GetUploadUrlDto,
} from './dto/lands.dto';
import {
  buildPaginatedResponse,
  LandMediaType,
  LandReservationStatus,
  LandStatus,
  PaginationQuery,
  StorageService,
} from '@kambriq/common';
import { LandsPrismaService } from './prisma/lands-prisma.service';

@Injectable()
export class LandsService {
  private readonly logger = new Logger(LandsService.name);

  constructor(
    private readonly prisma: LandsPrismaService,
    private readonly storageService: StorageService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Admin: Create Land ----- //
  async create(dto: CreateLandDto, adminUserId: string) {
    const slug = this.generateSlug(dto.title);

    const existingSlug = await this.prisma.land.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(this.t('lands.land.slugTaken'));
    }

    // Check title number uniqueness (if provided)
    if (dto.titleNumber) {
      const existingTitle = await this.prisma.land.findUnique({
        where: { titleNumber: dto.titleNumber },
      });
      if (existingTitle) {
        throw new ConflictException(this.t('lands.land.titleNumberTaken'));
      }
    }

    // Validate label exists
    const label = await this.prisma.landLabel.findUnique({
      where: { id: dto.labelId },
    });
    if (!label) {
      throw new NotFoundException(this.t('lands.label.notFound'));
    }

    const land = await this.prisma.land.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        region: dto.region,
        city: dto.city || null,
        neighborhood: dto.neighborhood || null,
        latitude: dto.latitude || null,
        longitude: dto.longitude || null,
        sizeM2: dto.sizeM2,
        price: dto.price,
        labelId: dto.labelId,
        pv: dto.pv,
        ownerType: dto.ownerType,
        partnerId: dto.partnerId || null,
        titleNumber: dto.titleNumber || null,
        surfaceTitle: dto.surfaceTitle || null,
        isPublished: dto.isPublished,
        isVerified: dto.isVerified,
        status: LandStatus.AVAILABLE,
      },
      include: { label: true },
    });

    this.logger.log('Land created', {
      landId: land.id,
      slug,
      adminUserId,
    });

    return land;
  }

  // ----- Admin: Update Land ----- //
  async update(landId: string, dto: UpdateLandDto, adminUserId: string) {
    const land = await this.findByIdOrThrow(landId);

    // Check title number uniqueness if changing
    if (dto.titleNumber && dto.titleNumber !== land.titleNumber) {
      const existingTitle = await this.prisma.land.findUnique({
        where: { titleNumber: dto.titleNumber },
      });
      if (existingTitle) {
        throw new ConflictException(this.t('lands.land.titleNumberTaken'));
      }
    }

    // Track price change if price is being updated
    if (dto.price !== undefined && dto.price !== land.price) {
      await this.prisma.landPriceHistory.create({
        data: {
          landId,
          previousPrice: land.price,
          newPrice: dto.price,
          changedBy: adminUserId,
          reason: `Price updated from ${land.price} to ${dto.price} XAF`,
        },
      });

      this.logger.log('Land price changed', {
        landId,
        from: land.price,
        to: dto.price,
        adminUserId,
      });
    }

    const updated = await this.prisma.land.update({
      where: { id: landId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.neighborhood !== undefined && {
          neighborhood: dto.neighborhood,
        }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.sizeM2 !== undefined && { sizeM2: dto.sizeM2 }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.labelId !== undefined && { labelId: dto.labelId }),
        ...(dto.pv !== undefined && { pv: dto.pv }),
        ...(dto.ownerType !== undefined && { ownerType: dto.ownerType }),
        ...(dto.partnerId !== undefined && { partnerId: dto.partnerId }),
        ...(dto.titleNumber !== undefined && { titleNumber: dto.titleNumber }),
        ...(dto.surfaceTitle !== undefined && {
          surfaceTitle: dto.surfaceTitle,
        }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
        ...(dto.isVerified !== undefined && {
          isVerified: dto.isVerified,
          ...(dto.isVerified && { verifiedAt: new Date() }),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { label: true },
    });

    this.logger.log('Land updated', { landId, adminUserId });
    return updated;
  }

  // ----- Admin: Archive Land ----- //
  async archive(landId: string, adminUserId: string) {
    await this.findByIdOrThrow(landId);

    const updated = await this.prisma.land.update({
      where: { id: landId },
      data: { status: LandStatus.ARCHIVED, isPublished: false },
    });

    this.logger.log('Land archived', { landId, adminUserId });
    return updated;
  }

  // ----- Agent: Browse Available Lands ----- //
  // Agents see only published, available lands (not reserved/sold).
  async findForAgents(query: PaginationQuery, filters?: LandFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isPublished: true,
      status: filters?.status || LandStatus.AVAILABLE,
    };

    if (filters?.region) {
      where.region = { contains: filters.region, mode: 'insensitive' };
    }
    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }
    if (filters?.labelCode) {
      where.label = { code: filters.labelCode };
    }
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters?.minPrice !== undefined) {
        (where.price as Record<string, unknown>).gte = filters.minPrice;
      }
      if (filters?.maxPrice !== undefined) {
        (where.price as Record<string, unknown>).lte = filters.maxPrice;
      }
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { neighborhood: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [lands, total] = await this.prisma.$transaction([
      this.prisma.land.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          label: { select: { code: true, name: true } },
          media: {
            where: { type: LandMediaType.IMAGE },
            orderBy: { order: 'asc' },
            take: 3,
          },
        },
      }),
      this.prisma.land.count({ where }),
    ]);

    const landsWithUrls = await Promise.all(
      lands.map(async (land) => ({
        ...land,
        media: await Promise.all(
          land.media.map(async (m) => ({
            ...m,
            downloadUrl: await this.storageService.getDownloadUrl(m.url),
          })),
        ),
      })),
    );

    return buildPaginatedResponse(landsWithUrls, total, page, limit);
  }

  // ----- Admin: List All Lands ----- //
  async findAll(query: PaginationQuery, filters?: LandFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.region) {
      where.region = { contains: filters.region, mode: 'insensitive' };
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { titleNumber: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [lands, total] = await this.prisma.$transaction([
      this.prisma.land.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          media: {
            select: {
              id: true,
              url: true,
            },
          },
          documents: {
            select: {
              id: true,
              name: true,
              type: true,
              isPrivate: true,
            },
          },
          label: { select: { code: true, name: true, id: true } },
          _count: {
            select: { media: true, documents: true, reservations: true },
          },
        },
      }),
      this.prisma.land.count({ where }),
    ]);

    const landsWithUrls = await Promise.all(
      lands.map(async (land) => ({
        ...land,
        media: await Promise.all(
          land.media.map(async (m) => ({
            ...m,
            downloadUrl: await this.storageService.getDownloadUrl(m.url),
          })),
        ),
      })),
    );

    return buildPaginatedResponse(landsWithUrls, total, page, limit);
  }

  // ----- Get Land Detail ----- //
  async findByIdFull(landId: string) {
    const land = await this.prisma.land.findUnique({
      where: { id: landId },
      include: {
        label: true,
        media: { orderBy: { order: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        priceHistory: { orderBy: { changedAt: 'desc' }, take: 10 },
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            clientName: true,
            agentUserId: true,
            clientEmail: true,
            clientPhone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!land) {
      throw new NotFoundException(this.t('lands.land.notFound'));
    }

    // Generate download URLs for media (signed S3 URLs)
    const mediaWithUrls = await Promise.all(
      land.media.map(async (m) => ({
        ...m,
        downloadUrl: await this.storageService.getDownloadUrl(m.url),
      })),
    );

    // Generate download URLs for documents (signed S3 URLs)
    const documentsWithUrls = await Promise.all(
      land.documents.map(async (d) => ({
        ...d,
        downloadUrl: await this.storageService.getDownloadUrl(d.url),
      })),
    );

    return {
      ...land,
      media: mediaWithUrls,
      documents: documentsWithUrls,
    };
  }

  // ----- Get Land by Slug ----- //
  async findBySlug(slug: string) {
    const land = await this.prisma.land.findUnique({
      where: { slug },
      include: {
        label: true,
        media: { orderBy: { order: 'asc' } },
      },
    });

    if (!land) {
      throw new NotFoundException(this.t('lands.land.notFound'));
    }

    return land;
  }

  // ----- Add Media ----- //
  async addMedia(dto: AddMediaDto) {
    await this.findByIdOrThrow(dto.landId);

    const media = await this.prisma.landMedia.create({
      data: {
        landId: dto.landId,
        type: dto.type,
        url: dto.url,
        caption: dto.caption || null,
        order: dto.order,
      },
    });

    this.logger.log('Media added to land', {
      landId: dto.landId,
      mediaId: media.id,
    });
    return media;
  }

  // ----- Delete Media ----- //
  async deleteMedia(mediaId: string) {
    const media = await this.prisma.landMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException(this.t('lands.media.notFound'));
    }

    // Delete from S3
    await this.storageService.deleteObject(media.url);

    // Delete from DB
    await this.prisma.landMedia.delete({ where: { id: mediaId } });

    this.logger.log('Media deleted', { mediaId, landId: media.landId });
  }

  // ----- Add Document ----- //
  async addDocument(dto: AddDocumentDto, uploadedBy: string) {
    await this.findByIdOrThrow(dto.landId);

    const document = await this.prisma.landDocument.create({
      data: {
        landId: dto.landId,
        type: dto.type,
        name: dto.name,
        url: dto.url,
        isPrivate: dto.isPrivate,
        uploadedBy,
      },
    });

    this.logger.log('Document added to land', {
      landId: dto.landId,
      documentId: document.id,
    });
    return document;
  }

  // ----- Delete Document ----- //
  async deleteDocument(documentId: string) {
    const doc = await this.prisma.landDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException(this.t('lands.document.notFound'));
    }

    // Delete from S3
    await this.storageService.deleteObject(doc.url);

    // Delete from DB
    await this.prisma.landDocument.delete({ where: { id: documentId } });

    this.logger.log('Document deleted', { documentId, landId: doc.landId });
  }

  // ----- Get Price History ----- //
  async getPriceHistory(landId: string) {
    await this.findByIdOrThrow(landId);

    return this.prisma.landPriceHistory.findMany({
      where: { landId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // ----- Generate S3 Upload URL ----- //
  // Returns a presigned URL for the frontend to upload directly to S3.
  async getUploadUrl(landId: string, dto: GetUploadUrlDto) {
    await this.findByIdOrThrow(landId);

    const timestamp = Date.now();
    const safeName = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = this.storageService.buildKey(
      'lands',
      dto.category,
      landId,
      `${timestamp}-${safeName}`,
    );

    return this.storageService.getUploadUrl(key, dto.contentType);
  }

  // ----- Update Land Status -----
  // Called by LandReservationsService to update land status
  // when a reservation changes state.
  async updateStatus(landId: string, status: LandStatus) {
    return this.prisma.land.update({
      where: { id: landId },
      data: { status },
    });
  }

  // ----- Admin: Global Stats -----
  async getStats() {
    const [available, reserved, sold, pendingReservations] = await Promise.all([
      this.prisma.land.count({ where: { status: LandStatus.AVAILABLE } }),
      this.prisma.land.count({ where: { status: LandStatus.RESERVED } }),
      this.prisma.land.count({ where: { status: LandStatus.SOLD } }),
      this.prisma.landReservation.count({ where: { status: LandReservationStatus.PENDING } }),
    ]);
    return { available, reserved, sold, pendingReservations };
  }

  // ----- Private Helpers ----- //

  async findByIdOrThrow(landId: string) {
    const land = await this.prisma.land.findUnique({
      where: { id: landId },
    });
    if (!land) {
      throw new NotFoundException(this.t('lands.land.notFound'));
    }
    return land;
  }

  /**
   * Generate a URL-safe slug from a title string.
   * Strips accents, lowercases, replaces spaces/special chars with hyphens.
   */
  private generateSlug(title: string): string {
    return slugify(title, { lower: true, strict: true });
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
