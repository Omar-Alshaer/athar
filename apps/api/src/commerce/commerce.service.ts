import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
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
import { normalizeInternationalPhone } from '../auth/phone.util';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import {
  XPayCheckoutSession,
  XPayService,
  XPayWebhookEvent,
} from './xpay.service';

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privateStorage: PrivateStorageService,
    private readonly xpay: XPayService,
  ) {}

  async createCheckoutSession(user: AuthenticatedUser, dto: CreateCheckoutSessionDto) {
    const items = this.normalizeItems(dto.items);
    const normalizedPhone = normalizeInternationalPhone(dto.phone, dto.phoneCountry);
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
    if (currency.trim().toUpperCase() !== 'SAR') {
      throw new BadRequestException('الدفع متاح حاليًا للمنتجات المسعرة بالريال السعودي فقط.');
    }
    const provider = this.paymentProvider();

    const orderNumber = this.generateOrderNumber();
    const total = this.centsToMoney(totalCents);

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT TRUE AS locked
        FROM (SELECT pg_advisory_xact_lock(hashtext(${`athr-checkout:${user.id}`}))) AS checkout_lock
      `;

      const alreadyOwned = await tx.libraryItem.findFirst({
        where: {
          userId: user.id,
          revokedAt: null,
          productId: { in: products.map((product) => product.id) },
        },
        select: { product: { select: { titleAr: true } } },
      });

      if (alreadyOwned) {
        throw new ConflictException(
          `المنتج «${alreadyOwned.product.titleAr}» موجود بالفعل في مكتبتك.`,
        );
      }

      const pendingPurchase = await tx.orderItem.findFirst({
        where: {
          productId: { in: products.map((product) => product.id) },
          order: {
            userId: user.id,
            status: OrderStatus.PENDING_PAYMENT,
          },
        },
        select: { productTitleSnapshot: true },
      });

      if (pendingPurchase) {
        throw new ConflictException(
          `يوجد طلب قيد الدفع للمنتج «${pendingPurchase.productTitleSnapshot}». استكمله من حسابك قبل إنشاء طلب جديد.`,
        );
      }

      if (
        normalizedPhone.phone !== user.phone ||
        normalizedPhone.phoneCountry !== user.phoneCountry
      ) {
        await tx.user.update({
          where: { id: user.id },
          data: normalizedPhone,
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
              providerCheckoutId:
                provider === PaymentProvider.MOCK
                  ? `mock_${orderNumber}`
                  : null,
              providerCheckoutUrl:
                provider === PaymentProvider.MOCK
                  ? `payment-mock.html?order=${encodeURIComponent(orderNumber)}`
                  : null,
            },
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });
    });

    if (provider === PaymentProvider.MOCK) {
      return {
        order: this.serializeOrder(order),
        payment: {
          provider,
          mode: 'HOSTED_MOCK',
          checkoutPath: `payment-mock.html?order=${encodeURIComponent(order.orderNumber)}`,
        },
      };
    }

    const payment = order.payments[0];

    try {
      const session = await this.xpay.createCheckoutSession({
        orderId: order.id,
        orderNumber: order.orderNumber,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: normalizedPhone.phone,
        },
        lines: lines.map((line) => ({
          name: line.product.titleAr,
          currency,
          unitAmount: line.unitCents,
          quantity: line.quantity,
          productId: line.product.id,
          slug: line.product.slug,
        })),
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerCheckoutId: session.id,
          providerCheckoutUrl: session.url,
        },
      });

      return {
        order: this.serializeOrder(order),
        payment: {
          provider,
          mode: 'HOSTED_XPAY',
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
        },
      };
    } catch (error) {
      await this.prisma
        .$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              failureCode: 'xpay_session_creation_failed',
              failureMessage:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : 'Unknown XPay checkout error',
            },
          }),
          this.prisma.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAYMENT_FAILED,
            },
          }),
        ])
        .catch(() => undefined);

      throw error;
    }
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

  async handleXPayWebhook(
    rawBody: Buffer,
    signatureHeader?: string,
  ) {
    const event = this.xpay.verifyWebhook(
      rawBody,
      signatureHeader,
    );

    const payloadHash = createHash('sha256')
      .update(rawBody)
      .digest('hex');

    const storedEvent =
      await this.prisma.paymentWebhookEvent.upsert({
        where: {
          providerEventId: event.id,
        },
        create: {
          provider: PaymentProvider.XPAY,
          providerEventId: event.id,
          eventType: event.type,
          payloadHash,
        },
        update: {},
      });

    if (
      storedEvent.provider !== PaymentProvider.XPAY ||
      storedEvent.payloadHash !== payloadHash
    ) {
      throw new BadRequestException(
        'Webhook event identifier reused with different content.',
      );
    }

    if (storedEvent.processedAt) {
      return {
        received: true,
        duplicate: true,
      };
    }

    try {
      await this.processXPayEvent(event);

      await this.prisma.paymentWebhookEvent.update({
        where: { id: storedEvent.id },
        data: {
          processedAt: new Date(),
          processingError: null,
        },
      });

      return {
        received: true,
        duplicate: false,
      };
    } catch (error) {
      await this.prisma.paymentWebhookEvent
        .update({
          where: { id: storedEvent.id },
          data: {
            processingError:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Unknown XPay webhook error',
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }

  private async processXPayEvent(
    event: XPayWebhookEvent,
  ): Promise<void> {
    const session = event.data.object;

    if (
      event.type === 'checkout.session.completed' ||
      event.type ===
        'checkout.session.async_payment_succeeded'
    ) {
      if (session.paymentStatus === 'paid') {
        await this.fulfillXPaySession(session);
      }

      return;
    }

    if (
      event.type ===
      'checkout.session.async_payment_failed'
    ) {
      await this.failXPaySession(session);
      return;
    }

    if (event.type === 'checkout.session.expired') {
      await this.cancelXPaySession(session);
    }
  }

  private async fulfillXPaySession(
    session: XPayCheckoutSession,
  ): Promise<void> {
    const payment =
      await this.resolveXPayPayment(session);

    this.assertXPaySessionMatchesPayment(
      session,
      payment,
    );

    if (
      payment.status === PaymentStatus.SUCCEEDED &&
      payment.order.status === OrderStatus.PAID
    ) {
      return;
    }

    if (
      payment.status === PaymentStatus.REFUNDED ||
      payment.order.status === OrderStatus.REFUNDED
    ) {
      return;
    }

    const paidAt = new Date();

    const providerPaymentId =
      session.paymentIntent?.id ||
      session.paymentIntentId ||
      payment.providerPaymentId ||
      null;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt,
          providerCheckoutId: session.id,
          providerPaymentId,
          failureCode: null,
          failureMessage: null,
        },
      });

      await tx.order.update({
        where: { id: payment.order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt,
        },
      });

      for (const item of payment.order.items) {
        if (!item.productId) continue;

        await tx.libraryItem.upsert({
          where: {
            userId_productId: {
              userId: payment.order.userId,
              productId: item.productId,
            },
          },
          create: {
            userId: payment.order.userId,
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
  }

  private async failXPaySession(
    session: XPayCheckoutSession,
  ): Promise<void> {
    const payment =
      await this.resolveXPayPayment(session);

    this.assertXPaySessionMatchesPayment(
      session,
      payment,
    );

    if (
      payment.status === PaymentStatus.SUCCEEDED ||
      payment.order.status === OrderStatus.PAID ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.order.status === OrderStatus.REFUNDED
    ) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerCheckoutId: session.id,
          failureCode: 'xpay_async_payment_failed',
          failureMessage:
            'XPay reported that the payment failed.',
        },
      }),

      this.prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: OrderStatus.PAYMENT_FAILED,
        },
      }),
    ]);
  }

  private async cancelXPaySession(
    session: XPayCheckoutSession,
  ): Promise<void> {
    const payment =
      await this.resolveXPayPayment(session);

    this.assertXPaySessionMatchesPayment(
      session,
      payment,
    );

    if (
      payment.status === PaymentStatus.SUCCEEDED ||
      payment.order.status === OrderStatus.PAID ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.order.status === OrderStatus.REFUNDED
    ) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CANCELLED,
          providerCheckoutId: session.id,
          failureCode: 'xpay_session_expired',
          failureMessage:
            'XPay checkout session expired before payment.',
        },
      }),

      this.prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      }),
    ]);
  }

  private async resolveXPayPayment(
    session: XPayCheckoutSession,
  ) {
    const direct =
      await this.prisma.payment.findFirst({
        where: {
          provider: PaymentProvider.XPAY,
          providerCheckoutId: session.id,
        },
        select: {
          id: true,
        },
      });

    let paymentId = direct?.id ?? null;

    if (!paymentId) {
      const orderNumber =
        this.xpayMetadataString(
          session,
          'orderNumber',
        );

      if (!orderNumber) {
        throw new BadRequestException(
          'XPay webhook is missing ATHR order metadata.',
        );
      }

      const order =
        await this.prisma.order.findFirst({
          where: {
            orderNumber,
          },
          include: {
            payments: true,
          },
        });

      const candidate =
        order?.payments.find(
          (item) =>
            item.provider ===
            PaymentProvider.XPAY,
        );

      if (!candidate) {
        throw new BadRequestException(
          'No ATHR payment matches this XPay session.',
        );
      }

      if (
        candidate.providerCheckoutId &&
        candidate.providerCheckoutId !==
          session.id
      ) {
        throw new BadRequestException(
          'XPay session does not match the stored payment.',
        );
      }

      paymentId = candidate.id;
    }

    const payment =
      await this.prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          order: {
            include: {
              items: true,
            },
          },
        },
      });

    if (!payment) {
      throw new BadRequestException(
        'ATHR payment was not found.',
      );
    }

    return payment;
  }

  private assertXPaySessionMatchesPayment(
    session: XPayCheckoutSession,
    payment: {
      amount: unknown;
      currency: string;
      order: {
        id: string;
        userId: string;
        orderNumber: string;
      };
    },
  ): void {
    const orderId =
      this.xpayMetadataString(
        session,
        'orderId',
      );

    const orderNumber =
      this.xpayMetadataString(
        session,
        'orderNumber',
      );

    const userId =
      this.xpayMetadataString(
        session,
        'userId',
      );

    if (
      orderId !== payment.order.id ||
      orderNumber !== payment.order.orderNumber ||
      userId !== payment.order.userId
    ) {
      throw new BadRequestException(
        'XPay ATHR order metadata mismatch.',
      );
    }

    const expectedCents =
      this.moneyToCents(payment.amount);

    const presentment =
      session.presentmentDetails;

    const receivedCurrency =
      presentment?.currency ??
      session.currency;

    const sessionCurrency =
      String(receivedCurrency ?? '')
        .trim()
        .toUpperCase();

    if (
      !sessionCurrency ||
      sessionCurrency !==
        payment.currency.trim().toUpperCase()
    ) {
      throw new BadRequestException(
        'XPay payment currency mismatch.',
      );
    }

    if (presentment) {
      const subtotal =
        presentment.amountSubtotal ??
        presentment.amount;

      if (
        !Number.isInteger(subtotal) ||
        subtotal !== expectedCents
      ) {
        throw new BadRequestException(
          'XPay payment subtotal mismatch.',
        );
      }

      if ((presentment.amountDiscount ?? 0) !== 0) {
        throw new BadRequestException(
          'Unexpected XPay payment discount.',
        );
      }

      const finalAmount =
        presentment.amountTotal;

      if (
        typeof finalAmount !== 'number' ||
        !Number.isInteger(finalAmount) ||
        finalAmount !== expectedCents
      ) {
        throw new BadRequestException(
          'XPay payment amount mismatch.',
        );
      }
    } else if (
      !Number.isInteger(session.amountTotal) ||
      session.amountTotal !== expectedCents
    ) {
      throw new BadRequestException(
        'XPay payment amount mismatch.',
      );
    }
  }

  private xpayMetadataString(
    session: XPayCheckoutSession,
    key: string,
  ): string {
    const value = session.metadata?.[key];

    return typeof value === 'string'
      ? value.trim()
      : '';
  }

  private normalizeItems(items: CreateCheckoutSessionDto['items']) {
    const seen = new Set<string>();

    for (const item of items) {
      const slug = item.slug.trim();

      if (!slug) {
        throw new BadRequestException('معرف المنتج غير صالح.');
      }

      if (item.quantity !== 1) {
        throw new BadRequestException(
          'يمكن شراء نسخة واحدة فقط من كل منتج رقمي.',
        );
      }

      if (seen.has(slug)) {
        throw new BadRequestException(
          'لا يمكن إضافة نفس المنتج الرقمي أكثر من مرة.',
        );
      }

      seen.add(slug);
    }

    return [...seen].map((slug) => ({
      slug,
      quantity: 1,
    }));
  }

  private paymentProvider(): PaymentProvider {
    const provider = String(process.env.PAYMENT_PROVIDER ?? '').trim().toLowerCase();
    if (provider === 'xpay') return PaymentProvider.XPAY;
    if (
      provider === 'mock' &&
      process.env.NODE_ENV !== 'production' &&
      String(process.env.MOCK_PAYMENT_ENABLED).trim().toLowerCase() === 'true'
    ) {
      return PaymentProvider.MOCK;
    }
    throw new ServiceUnavailableException('إعداد بوابة الدفع غير صالح.');
  }

  private assertMockPaymentsEnabled(): void {
    if (this.paymentProvider() !== PaymentProvider.MOCK) {
      throw new BadRequestException('الدفع التجريبي غير متاح مع بوابة الدفع الحالية.');
    }

    if (process.env.NODE_ENV === 'production') {
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
      providerCheckoutUrl: string | null;
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
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        checkoutUrl: payment.providerCheckoutUrl,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
    };
  }
}
