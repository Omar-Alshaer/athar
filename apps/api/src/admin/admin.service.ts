import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NewsletterStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductImageKind,
  ProductStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrivateStorageService } from '../storage/private-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { UploadProductImageDto } from './dto/product-image.dto';

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

export type UploadedDigitalFile = UploadedImageFile;

const productAdminInclude = {
  category: {
    select: { id: true, slug: true, nameAr: true },
  },
  images: {
    orderBy: [{ kind: 'asc' as const }, { sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      kind: true,
      secureUrl: true,
      cloudinaryPublicId: true,
      altAr: true,
      width: true,
      height: true,
      sortOrder: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductAdminPayload = Prisma.ProductGetPayload<{
  include: typeof productAdminInclude;
}>;

@Injectable()
export class AdminService {
  private readonly allowedImageMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ]);
  private readonly maxImageBytes = 8 * 1024 * 1024;
  private readonly maxGalleryImages = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly privateStorage: PrivateStorageService,
  ) {}

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
          currency: 'SAR',
        },
      },
      cloudinary: { configured: this.cloudinary.isConfigured() },
      recentUsers,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total),
      })),
    };
  }

  cloudinaryStatus() {
    return {
      configured: this.cloudinary.isConfigured(),
      maxImageBytes: this.maxImageBytes,
      maxGalleryImages: this.maxGalleryImages,
      acceptedTypes: [...this.allowedImageMimeTypes],
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
        phoneCountry: true,
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
      include: productAdminInclude,
    });

    return { items: items.map((item) => this.serializeProduct(item)) };
  }

  async product(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productAdminInclude,
    });

    if (!product) throw new NotFoundException('المنتج غير موجود.');
    return { product: this.serializeProduct(product) };
  }

  async createProduct(dto: CreateProductDto, actorUserId: string) {
    await this.assertCategoryExists(dto.categoryId);
    await this.assertProductSlugAvailable(dto.slug);

    const status = dto.status ?? ProductStatus.DRAFT;
    if (status === ProductStatus.PUBLISHED) {
      throw new BadRequestException(
        'أنشئ المنتج كمسودة أولًا، ثم ارفع الملف الرقمي قبل نشره.',
      );
    }

    const product = await this.prisma.product.create({
      data: {
        slug: dto.slug,
        titleAr: dto.titleAr.trim(),
        subtitleAr: dto.subtitleAr.trim(),
        descriptionAr: dto.descriptionAr?.trim(),
        categoryId: dto.categoryId,
        price: dto.price,
        currency: dto.currency ?? 'SAR',
        status,
        featured: dto.featured ?? false,
        badgeAr: dto.badgeAr?.trim(),
        formatLabelAr: dto.formatLabelAr?.trim() || 'PDF رقمي',
        contentLabelAr: dto.contentLabelAr?.trim() || 'منتج رقمي',
        publishedAt: null,
      },
      include: productAdminInclude,
    });

    await this.audit(actorUserId, 'PRODUCT_CREATE', 'Product', product.id, {
      slug: product.slug,
      status: product.status,
    });

    return { product: this.serializeProduct(product) };
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorUserId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('المنتج غير موجود.');

    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertProductSlugAvailable(dto.slug, id);
    }

    const nextStatus = dto.status ?? existing.status;

    if (
      nextStatus === ProductStatus.PUBLISHED &&
      existing.status !== ProductStatus.PUBLISHED &&
      !existing.digitalFileKey
    ) {
      throw new BadRequestException(
        'لا يمكن نشر المنتج قبل رفع الملف الرقمي.',
      );
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr.trim() } : {}),
        ...(dto.subtitleAr !== undefined ? { subtitleAr: dto.subtitleAr.trim() } : {}),
        ...(dto.descriptionAr !== undefined ? { descriptionAr: dto.descriptionAr.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        ...(dto.badgeAr !== undefined ? { badgeAr: dto.badgeAr.trim() } : {}),
        ...(dto.formatLabelAr !== undefined ? { formatLabelAr: dto.formatLabelAr.trim() } : {}),
        ...(dto.contentLabelAr !== undefined ? { contentLabelAr: dto.contentLabelAr.trim() } : {}),
        ...(dto.status !== undefined
          ? {
              publishedAt:
                nextStatus === ProductStatus.PUBLISHED
                  ? existing.publishedAt ?? new Date()
                  : nextStatus === ProductStatus.DRAFT
                    ? null
                    : existing.publishedAt,
            }
          : {}),
      },
      include: productAdminInclude,
    });

    await this.audit(actorUserId, 'PRODUCT_UPDATE', 'Product', product.id, {
      changedFields: Object.keys(dto),
      status: product.status,
    });

    return { product: this.serializeProduct(product) };
  }

  async deleteProduct(id: string, actorUserId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { select: { cloudinaryPublicId: true } },
        _count: { select: { orderItems: true, libraryItems: true } },
      },
    });

    if (!product) throw new NotFoundException('المنتج غير موجود.');
    if (product._count.orderItems > 0 || product._count.libraryItems > 0) {
      throw new ConflictException('لا يمكن حذف منتج له سجل شراء أو مكتبة. استخدم حالة مؤرشف بدلًا من الحذف.');
    }

    await this.prisma.product.delete({ where: { id } });
    await this.audit(actorUserId, 'PRODUCT_DELETE', 'Product', id, { slug: product.slug });

    await Promise.allSettled([
      ...product.images.map((image) => this.cloudinary.deleteImage(image.cloudinaryPublicId)),
      ...(product.digitalFileKey ? [this.privateStorage.deleteFile(product.digitalFileKey)] : []),
    ]);

    return { ok: true };
  }

  async uploadProductDigitalFile(
    id: string,
    file: UploadedDigitalFile | undefined,
    actorUserId: string,
  ) {
    const validated = this.validateDigitalFile(file);
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        digitalFileKey: true,
      },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود.');

    const extension = this.digitalFileExtension(validated);
    const stored = await this.privateStorage.saveProductFile(id, validated.buffer, extension);
    const originalName = this.safeOriginalFileName(validated.originalname, extension);

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          digitalFileKey: stored.key,
          digitalFileName: originalName,
          digitalFileMime: extension === '.pdf' ? 'application/pdf' : 'application/epub+zip',
          digitalFileBytes: BigInt(validated.size),
        },
        include: productAdminInclude,
      });

      if (product.digitalFileKey && product.digitalFileKey !== stored.key) {
        await this.privateStorage.deleteFile(product.digitalFileKey).catch(() => undefined);
      }

      await this.audit(actorUserId, 'PRODUCT_DIGITAL_FILE_UPLOAD', 'Product', id, {
        fileName: originalName,
        mimeType: validated.mimetype,
        bytes: validated.size,
      });

      return { product: this.serializeProduct(updated) };
    } catch (error) {
      await this.privateStorage.deleteFile(stored.key).catch(() => undefined);
      throw error;
    }
  }

  async deleteProductDigitalFile(id: string, actorUserId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        digitalFileKey: true,
        digitalFileName: true,
      },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود.');
    if (!product.digitalFileKey) return { ok: true, alreadyEmpty: true };

    const oldKey = product.digitalFileKey;
    const oldName = product.digitalFileName;
    await this.prisma.product.update({
      where: { id },
      data: {
        digitalFileKey: null,
        digitalFileName: null,
        digitalFileMime: null,
        digitalFileBytes: null,
        status: ProductStatus.DRAFT,
        publishedAt: null,
      },
    });
    await this.privateStorage.deleteFile(oldKey).catch(() => undefined);
    await this.audit(actorUserId, 'PRODUCT_DIGITAL_FILE_DELETE', 'Product', id, {
      fileName: oldName,
    });
    return { ok: true, alreadyEmpty: false };
  }

  async uploadProductCover(
    id: string,
    file: UploadedImageFile | undefined,
    dto: UploadProductImageDto,
    actorUserId: string,
  ) {
    const product = await this.requireProduct(id);
    const validFile = this.validateImageFile(file);
    const oldCovers = await this.prisma.productImage.findMany({
      where: { productId: id, kind: ProductImageKind.COVER },
      select: { cloudinaryPublicId: true },
    });

    const uploaded = await this.cloudinary.uploadImage({
      buffer: validFile.buffer,
      folder: `products/${product.slug}/cover`,
    });

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        await tx.productImage.deleteMany({
          where: { productId: id, kind: ProductImageKind.COVER },
        });
        return tx.productImage.create({
          data: {
            productId: id,
            kind: ProductImageKind.COVER,
            cloudinaryPublicId: uploaded.public_id,
            secureUrl: uploaded.secure_url,
            altAr: dto.altAr?.trim() || product.titleAr,
            width: uploaded.width,
            height: uploaded.height,
            sortOrder: 0,
          },
        });
      });

      await Promise.allSettled(
        oldCovers.map((cover) => this.cloudinary.deleteImage(cover.cloudinaryPublicId)),
      );
      await this.audit(actorUserId, 'PRODUCT_COVER_UPLOAD', 'Product', id, {
        imageId: image.id,
      });
      return { image };
    } catch (error) {
      await this.cloudinary.deleteImage(uploaded.public_id).catch(() => undefined);
      throw error;
    }
  }

  async uploadProductGalleryImage(
    id: string,
    file: UploadedImageFile | undefined,
    dto: UploadProductImageDto,
    actorUserId: string,
  ) {
    const product = await this.requireProduct(id);
    const validFile = this.validateImageFile(file);
    const galleryCount = await this.prisma.productImage.count({
      where: { productId: id, kind: ProductImageKind.GALLERY },
    });
    if (galleryCount >= this.maxGalleryImages) {
      throw new BadRequestException(`الحد الأقصى لصور المعرض هو ${this.maxGalleryImages} صور.`);
    }

    const uploaded = await this.cloudinary.uploadImage({
      buffer: validFile.buffer,
      folder: `products/${product.slug}/gallery`,
    });

    try {
      const image = await this.prisma.productImage.create({
        data: {
          productId: id,
          kind: ProductImageKind.GALLERY,
          cloudinaryPublicId: uploaded.public_id,
          secureUrl: uploaded.secure_url,
          altAr: dto.altAr?.trim() || product.titleAr,
          width: uploaded.width,
          height: uploaded.height,
          sortOrder: dto.sortOrder ?? (galleryCount + 1) * 10,
        },
      });
      await this.audit(actorUserId, 'PRODUCT_GALLERY_UPLOAD', 'Product', id, {
        imageId: image.id,
      });
      return { image };
    } catch (error) {
      await this.cloudinary.deleteImage(uploaded.public_id).catch(() => undefined);
      throw error;
    }
  }

  async deleteProductImage(
    productId: string,
    imageId: string,
    actorUserId: string,
  ) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('الصورة غير موجودة.');

    await this.prisma.productImage.delete({ where: { id: image.id } });
    await this.cloudinary.deleteImage(image.cloudinaryPublicId).catch(() => undefined);
    await this.audit(actorUserId, 'PRODUCT_IMAGE_DELETE', 'Product', productId, {
      imageId,
      kind: image.kind,
    });

    return { ok: true };
  }

  async categories() {
    const items = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameAr: true,
        shortAr: true,
        descriptionAr: true,
        icon: true,
        tone: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    });

    return { items };
  }

  async createCategory(dto: CreateCategoryDto, actorUserId: string) {
    await this.assertCategorySlugAvailable(dto.slug);
    const category = await this.prisma.category.create({
      data: {
        slug: dto.slug,
        nameAr: dto.nameAr.trim(),
        shortAr: dto.shortAr?.trim(),
        descriptionAr: dto.descriptionAr?.trim(),
        icon: dto.icon?.trim(),
        tone: dto.tone?.trim(),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit(actorUserId, 'CATEGORY_CREATE', 'Category', category.id, {
      slug: category.slug,
    });
    return { category };
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actorUserId: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('التصنيف غير موجود.');
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertCategorySlugAvailable(dto.slug, id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.shortAr !== undefined ? { shortAr: dto.shortAr.trim() } : {}),
        ...(dto.descriptionAr !== undefined ? { descriptionAr: dto.descriptionAr.trim() } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon.trim() } : {}),
        ...(dto.tone !== undefined ? { tone: dto.tone.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    await this.audit(actorUserId, 'CATEGORY_UPDATE', 'Category', category.id, {
      changedFields: Object.keys(dto),
    });
    return { category };
  }

  async deleteCategory(id: string, actorUserId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('التصنيف غير موجود.');
    if (category._count.products > 0) {
      throw new ConflictException('لا يمكن حذف تصنيف يحتوي على منتجات. عطّله بدلًا من الحذف.');
    }

    await this.prisma.category.delete({ where: { id } });
    await this.audit(actorUserId, 'CATEGORY_DELETE', 'Category', id, {
      slug: category.slug,
    });
    return { ok: true };
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

  private serializeProduct(product: ProductAdminPayload) {
    const { digitalFileKey, digitalFileBytes, ...safeProduct } = product;
    return {
      ...safeProduct,
      price: Number(product.price),
      ratingAverage: Number(product.ratingAverage),
      digitalFileReady: Boolean(digitalFileKey),
      digitalFileBytes: digitalFileBytes === null ? null : Number(digitalFileBytes),
    };
  }

  private async requireProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, titleAr: true },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود.');
    return product;
  }

  private validateImageFile(file: UploadedImageFile | undefined): UploadedImageFile {
    if (!file?.buffer?.length) throw new BadRequestException('اختر صورة أولًا.');
    if (!this.allowedImageMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('الصور المسموحة: JPG, PNG, WEBP, AVIF فقط.');
    }
    if (file.size > this.maxImageBytes) {
      throw new BadRequestException('حجم الصورة يجب ألا يتجاوز 8MB.');
    }
    if (!this.hasValidImageSignature(file)) {
      throw new BadRequestException('محتوى الصورة لا يطابق نوع الملف المسموح.');
    }
    return file;
  }

  private validateDigitalFile(file: UploadedDigitalFile | undefined): UploadedDigitalFile {
    if (!file?.buffer?.length) throw new BadRequestException('اختر ملف الكتاب أولًا.');
    if (file.size > 80 * 1024 * 1024) {
      throw new BadRequestException('حجم ملف الكتاب يجب ألا يتجاوز 80MB.');
    }
    this.digitalFileExtension(file);
    return file;
  }

  private digitalFileExtension(file: UploadedDigitalFile): '.pdf' | '.epub' {
    const lowerName = file.originalname.toLowerCase();
    if (
      lowerName.endsWith('.pdf') &&
      ['application/pdf', 'application/octet-stream'].includes(file.mimetype) &&
      file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      return '.pdf';
    }
    if (
      lowerName.endsWith('.epub') &&
      ['application/epub+zip', 'application/octet-stream'].includes(file.mimetype) &&
      file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
      file.buffer.subarray(0, Math.min(file.buffer.length, 256)).includes(Buffer.from('application/epub+zip'))
    ) {
      return '.epub';
    }
    throw new BadRequestException('ملفات الكتب المسموحة حاليًا: PDF أو EPUB فقط.');
  }

  private hasValidImageSignature(file: UploadedImageFile): boolean {
    const bytes = file.buffer;
    if (file.mimetype === 'image/jpeg') {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (file.mimetype === 'image/png') {
      return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (file.mimetype === 'image/webp') {
      return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    if (file.mimetype === 'image/avif') {
      const brand = bytes.subarray(8, 12).toString('ascii');
      return bytes.subarray(4, 8).toString('ascii') === 'ftyp' && ['avif', 'avis'].includes(brand);
    }
    return false;
  }

  private safeOriginalFileName(name: string, extension: '.pdf' | '.epub'): string {
    const cleaned = name
      .replace(/[\/\\]/g, '-')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 180);
    return cleaned || `athr-book${extension}`;
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.count({ where: { id } });
    if (!exists) throw new BadRequestException('التصنيف المحدد غير موجود.');
  }

  private async assertProductSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Slug المنتج مستخدم بالفعل.');
    }
  }

  private async assertCategorySlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Slug التصنيف مستخدم بالفعل.');
    }
  }

  private async audit(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  }
}
