import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductImageKind, ProductStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const wishlistProductInclude = {
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

type WishlistProduct = Prisma.ProductGetPayload<{ include: typeof wishlistProductInclude }>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: {
        userId,
        product: {
          status: ProductStatus.PUBLISHED,
          category: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: wishlistProductInclude } },
    });

    return {
      items: rows.map((row) => ({
        createdAt: row.createdAt,
        product: this.serializeProduct(row.product),
      })),
    };
  }

  async add(userId: string, slug: string) {
    const product = await this.findAvailableProduct(slug);

    await this.prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId: product.id,
        },
      },
      update: {},
      create: {
        userId,
        productId: product.id,
      },
    });

    return { ok: true, productSlug: product.slug };
  }

  async remove(userId: string, slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (product) {
      await this.prisma.wishlistItem.deleteMany({
        where: { userId, productId: product.id },
      });
    }

    return { ok: true };
  }

  async sync(userId: string, rawSlugs: string[]) {
    const productSlugs = [...new Set(rawSlugs.map((slug) => slug.trim()).filter(Boolean))].slice(0, 100);

    if (productSlugs.length) {
      const products = await this.prisma.product.findMany({
        where: {
          slug: { in: productSlugs },
          status: ProductStatus.PUBLISHED,
          category: { isActive: true },
        },
        select: { id: true },
      });

      if (products.length) {
        await this.prisma.wishlistItem.createMany({
          data: products.map((product) => ({ userId, productId: product.id })),
          skipDuplicates: true,
        });
      }
    }

    return this.list(userId);
  }

  private async findAvailableProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        category: { isActive: true },
      },
      select: { id: true, slug: true },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير متاح حاليًا.');
    }

    return product;
  }

  private serializeProduct(product: WishlistProduct) {
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
}
