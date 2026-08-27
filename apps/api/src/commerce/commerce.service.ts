import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  LibraryGrantSource,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ProductImageKind,
  ProductStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrivateStorageService } from '../storage/private-storage.service';
import { AuthenticatedUser } from '../auth/session.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

  async createCheckoutSession(user: AuthenticatedUser, dto: CreateCheckoutSessionDto) {
    const items = this.normalizeItems(dto.items);
    const slugs = items.map((item) => item.slug);

    const products = await this.prisma.product.findMany({
      where: {
        slug: { in: slugs },
        status: ProductStatus.PUBLISHED,
        category: { isActive: true },
      },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        price: true,
        currency: true,
      },
    });

    if (products.length !== slugs.length) {
      throw new BadRequestException('يوجد منتج غير متاح أو غير منشور داخل السلة. حدّث السلة وحاول مرة أخرى.');
    }

    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const currencies = new Set(products.map((product) => product.currency));
    if (currencies.size !== 1) {
      throw new BadRequestException('لا يمكن إنشاء طلب بعملات مختلفة.');
    }

    const lines = items.map((item) => {
      const product = productBySlug.get(item.slug)!;
      const unitCents = this.moneyToCents(product.price);
      return {
        product,
        quantity: item.quantity,
        unitCents,
        lineCents: unitCents * item.quantity,
      };
    });

    const totalCents = lines.reduce((sum, item) => sum + item.lineCents, 0);
    if (totalCents <= 0) throw new BadRequestException('قيمة الطلب غير صالحة.');

    const currency = products[0].currency;
    const provider = this.paymentProvider();
    if (provider !== PaymentProvider.MOCK) {
      throw new ServiceUnavailableException('بوابة الدفع الحقيقية لم يتم تفعيلها بعد.');
    }

    const orderNumber = this.generateOrderNumber();
    const total = this.centsToMoney(totalCents);

    const order = await this.prisma.$transaction(async (tx) => {
      if (dto.phone.trim() !== (user.phone ?? '').trim()) {
        await tx.user.update({
          where: { id: user.id },
          data: { phone: dto.phone.trim() },
        });
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          status: OrderStatus.PENDING_PAYMENT,
          currency,
          subtotal: total,
          total,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              productTitleSnapshot: line.product.titleAr,
              unitPrice: this.centsToMoney(line.unitCents),
              quantity: line.quantity,
              lineTotal: this.centsToMoney(line.lineCents),
            })),
          },
          payments: {
            create: {
              provider,
              status: PaymentStatus.PENDING,
              amount: total,
              currency,
              providerCheckoutId: `mock_${orderNumber}`,
            },
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });
    });

    return {
      order: this.serializeOrder(order),
      payment: {
        provider,
        mode: 'HOSTED_MOCK',
        checkoutPath: `payment-mock.html?order=${encodeURIComponent(order.orderNumber)}`,
      },
    };
  }

  async myOrders(userId: string) {
    const items = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    return { items: items.map((order) => this.serializeOrder(order)) };
  }

  async order(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, orderNumber },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) throw new NotFoundException('الطلب غير موجود.');
    return { order: this.serializeOrder(order) };
  }

  async library(userId: string) {
    const items = await this.prisma.libraryItem.findMany({
      where: { userId, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
      include: {
        product: {
          include: {
            category: { select: { slug: true, nameAr: true } },
            images: {
              orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                kind: true,
                secureUrl: true,
                altAr: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    return {
      items: items.map((item) => {
        const cover =
          item.product.images.find((image) => image.kind === ProductImageKind.COVER) ??
          item.product.images[0] ??
          null;

        return {
          id: item.id,
          grantedAt: item.grantedAt,
          source: item.source,
          product: {
            id: item.product.id,
            slug: item.product.slug,
            titleAr: item.product.titleAr,
            subtitleAr: item.product.subtitleAr,
            formatLabelAr: item.product.formatLabelAr,
            digitalFileReady: Boolean(item.product.digitalFileKey),
            digitalFileName: item.product.digitalFileName,
            digitalFileMime: item.product.digitalFileMime,
            digitalFileBytes: item.product.digitalFileBytes === null ? null : Number(item.product.digitalFileBytes),
            category: item.product.category,
            coverImage: cover,
          },
        };
      }),
    };
  }

  async prepareLibraryDownload(userId: string, libraryItemId: string) {
    const item = await this.prisma.libraryItem.findFirst({
      where: {
        id: libraryItemId,
        userId,
        revokedAt: null,
      },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            digitalFileKey: true,
            digitalFileName: true,
            digitalFileMime: true,
            digitalFileBytes: true,
          },
        },
      },
    });

    if (!item) throw new NotFoundException('هذا المنتج غير موجود في مكتبتك.');
    if (!item.product.digitalFileKey) {
      throw new ServiceUnavailableException('ملف هذا المنتج لم يتم رفعه بعد. حاول مرة أخرى لاحقًا.');
    }

    const stored = await this.privateStorage.getFile(item.product.digitalFileKey);
    if (!stored) {
      throw new ServiceUnavailableException('ملف المنتج غير متاح حاليًا على خادم التخزين.');
    }

    await this.prisma.downloadLog.create({
      data: {
        userId,
        libraryItemId: item.id,
      },
    });

    return {
      absolutePath: stored.absolutePath,
      fileName: item.product.digitalFileName || `athr-${item.product.slug}`,
      mimeType: item.product.digitalFileMime || 'application/octet-stream',
      size: stored.size,
    };
  }

  async completeMockPayment(userId: string, orderNumber: string) {
    this.assertMockPaymentsEnabled();

    const existing = await this.prisma.order.findFirst({
      where: { userId, orderNumber },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!existing) throw new NotFoundException('الطلب غير موجود.');
    if (existing.status === OrderStatus.PAID) {
      return { ok: true, alreadyPaid: true, order: this.serializeOrder(existing) };
    }

    if (
      existing.status !== OrderStatus.PENDING_PAYMENT &&
      existing.status !== OrderStatus.PAYMENT_FAILED
    ) {
      throw new BadRequestException('هذا الطلب لا يمكن دفعه في حالته الحالية.');
    }

    const payment = existing.payments.find((item) => item.provider === PaymentProvider.MOCK);
    if (!payment) throw new BadRequestException('جلسة الدفع التجريبية غير موجودة.');

    const paidAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt,
          providerPaymentId: payment.providerPaymentId ?? `mock_paid_${orderNumber}`,
          failureCode: null,
          failureMessage: null,
        },
      });

      await tx.order.update({
        where: { id: existing.id },
        data: { status: OrderStatus.PAID, paidAt },
      });

      for (const item of existing.items) {
        if (!item.productId) continue;
        await tx.libraryItem.upsert({
          where: {
            userId_productId: {
              userId,
              productId: item.productId,
            },
          },
          create: {
            userId,
            productId: item.productId,
            orderItemId: item.id,
            source: LibraryGrantSource.PURCHASE,
          },
          update: {
            revokedAt: null,
            orderItemId: item.id,
            source: LibraryGrantSource.PURCHASE,
          },
        });
      }
    });

    const paid = await this.prisma.order.findUnique({
      where: { id: existing.id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    return { ok: true, alreadyPaid: false, order: this.serializeOrder(paid!) };
  }

  private normalizeItems(items: CreateCheckoutSessionDto['items']) {
    const merged = new Map<string, number>();
    for (const item of items) {
      const slug = item.slug.trim();
      if (!slug) throw new BadRequestException('معرف المنتج غير صالح.');
      const next = (merged.get(slug) ?? 0) + item.quantity;
      if (next > 10) throw new BadRequestException('الحد الأقصى للكمية من المنتج الواحد هو 10.');
      merged.set(slug, next);
    }
    return [...merged.entries()].map(([slug, quantity]) => ({ slug, quantity }));
  }

  private paymentProvider(): PaymentProvider {
    const provider = String(process.env.PAYMENT_PROVIDER ?? 'mock').trim().toLowerCase();
    return provider === 'xpay' ? PaymentProvider.XPAY : PaymentProvider.MOCK;
  }

  private assertMockPaymentsEnabled(): void {
    if (this.paymentProvider() !== PaymentProvider.MOCK) {
      throw new BadRequestException('الدفع التجريبي غير متاح مع بوابة الدفع الحالية.');
    }

    if (process.env.NODE_ENV === 'production' && process.env.MOCK_PAYMENT_ENABLED !== 'true') {
      throw new BadRequestException('الدفع التجريبي معطل في بيئة الإنتاج.');
    }
  }

  private generateOrderNumber(): string {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `ATHR-${stamp}-${suffix}`;
  }

  private moneyToCents(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new BadRequestException('سعر المنتج غير صالح.');
    return Math.round(amount * 100);
  }

  private centsToMoney(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private serializeOrder(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    currency: string;
    subtotal: unknown;
    total: unknown;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      productId: string | null;
      productTitleSnapshot: string;
      unitPrice: unknown;
      quantity: number;
      lineTotal: unknown;
    }>;
    payments: Array<{
      id: string;
      provider: PaymentProvider;
      status: PaymentStatus;
      amount: unknown;
      currency: string;
      paidAt: Date | null;
      createdAt: Date;
    }>;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.productTitleSnapshot,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
    };
  }
}
