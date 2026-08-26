import { Injectable } from '@nestjs/common';
import {
  NewsletterStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      usersTotal,
      customers,
      admins,
      suspendedUsers,
      productsTotal,
      productsPublished,
      productsDraft,
      categoriesTotal,
      activeCategories,
      newsletterSubscribers,
      ordersTotal,
      paidOrders,
      pendingOrders,
      successfulPayments,
      revenue,
      recentUsers,
      recentOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({
        where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
      }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.PUBLISHED } }),
      this.prisma.product.count({ where: { status: ProductStatus.DRAFT } }),
      this.prisma.category.count(),
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.newsletterSubscription.count({
        where: { status: NewsletterStatus.SUBSCRIBED },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUCCEEDED } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
          user: { select: { fullName: true, email: true } },
        },
      }),
    ]);

    return {
      stats: {
        users: {
          total: usersTotal,
          customers,
          admins,
          suspended: suspendedUsers,
        },
        products: {
          total: productsTotal,
          published: productsPublished,
          draft: productsDraft,
        },
        categories: { total: categoriesTotal, active: activeCategories },
        newsletterSubscribers,
        orders: { total: ordersTotal, paid: paidOrders, pending: pendingOrders },
        payments: { successful: successfulPayments },
        revenue: {
          amount: Number(revenue._sum.total ?? 0),
          currency: 'USD',
        },
      },
      recentUsers,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total),
      })),
    };
  }

  async users() {
    const items = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            wishlistItems: true,
            libraryItems: true,
          },
        },
      },
    });

    return { items };
  }

  async newsletter() {
    const items = await this.prisma.newsletterSubscription.findMany({
      orderBy: { subscribedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        status: true,
        source: true,
        subscribedAt: true,
        unsubscribedAt: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    return { items };
  }

  async products() {
    const items = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        slug: true,
        titleAr: true,
        subtitleAr: true,
        price: true,
        currency: true,
        status: true,
        featured: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, slug: true, nameAr: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { secureUrl: true, kind: true, altAr: true },
        },
      },
    });

    return {
      items: items.map((item) => ({ ...item, price: Number(item.price) })),
    };
  }

  async categories() {
    const items = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameAr: true,
        shortAr: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    });

    return { items };
  }

  async orders() {
    const items = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        total: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { items: true, payments: true } },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        subtotal: Number(item.subtotal),
        total: Number(item.total),
      })),
    };
  }
}
