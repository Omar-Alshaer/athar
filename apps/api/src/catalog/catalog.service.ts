import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductImageKind,
  ProductStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ProductListQuery = {
  category?: string;
  featured?: string;
  q?: string;
  sort?: string;
  page?: string;
  limit?: string;
};

const productInclude = {
  category: {
    select: {
      id: true,
      slug: true,
      nameAr: true,
      shortAr: true,
      icon: true,
      tone: true,
    },
  },
  images: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      kind: true,
      secureUrl: true,
      cloudinaryPublicId: true,
      altAr: true,
      width: true,
      height: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const items = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameAr: true,
        shortAr: true,
        descriptionAr: true,
        icon: true,
        tone: true,
        sortOrder: true,
      },
    });

    return { items };
  }

  async listProducts(query: ProductListQuery) {
    const page = this.toPositiveInt(query.page, 1, 1, 100000);
    const limit = this.toPositiveInt(query.limit, 24, 1, 48);
    const search = query.q?.trim();

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      category: {
        isActive: true,
        ...(query.category ? { slug: query.category } : {}),
      },
      ...(query.featured === 'true' ? { featured: true } : {}),
      ...(search
        ? {
            OR: [
              { titleAr: { contains: search, mode: 'insensitive' } },
              { subtitleAr: { contains: search, mode: 'insensitive' } },
              { descriptionAr: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy = this.productSort(query.sort);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: rows.map((product) => this.serializeProduct(product)),
      meta: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        category: { isActive: true },
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product was not found.');
    }

    return this.serializeProduct(product);
  }

  private serializeProduct(product: ProductWithRelations) {
    const coverImage =
      product.images.find((image) => image.kind === ProductImageKind.COVER) ??
      product.images[0] ??
      null;

    return {
      id: product.id,
      slug: product.slug,
      titleAr: product.titleAr,
      subtitleAr: product.subtitleAr,
      descriptionAr: product.descriptionAr,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
      sarPrice: Number(product.sarPrice),
      sarCompareAtPrice: product.sarCompareAtPrice === null ? null : Number(product.sarCompareAtPrice),
      currency: product.currency,
      featured: product.featured,
      badgeAr: product.badgeAr,
      formatLabelAr: product.formatLabelAr,
      contentLabelAr: product.contentLabelAr,
      ratingAverage: Number(product.ratingAverage),
      reviewCount: product.reviewCount,
      publishedAt: product.publishedAt,
      category: product.category,
      coverImage,
      images: product.images,
    };
  }

  private productSort(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price-low':
        return [{ price: 'asc' }, { createdAt: 'desc' }];
      case 'price-high':
        return [{ price: 'desc' }, { createdAt: 'desc' }];
      case 'popular':
        return [{ reviewCount: 'desc' }, { ratingAverage: 'desc' }, { createdAt: 'desc' }];
      case 'new':
        return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
      default:
        return [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private toPositiveInt(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
