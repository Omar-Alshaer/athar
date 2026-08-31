import { config as loadEnv } from 'dotenv';
import { PrismaClient, ProductStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

loadEnv({ path: '../../.env' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed ATHR.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const categories = [
  {
    slug: 'kids',
    nameAr: 'قصص الأطفال والتربية',
    shortAr: 'طفل أكثر وعيًا',
    descriptionAr: 'قصص وأنشطة تزرع القيم وتنمي شخصية الطفل.',
    icon: 'book',
    tone: 'sage',
    sortOrder: 10,
  },
  {
    slug: 'wellness',
    nameAr: 'الصحة النفسية والتوازن',
    shortAr: 'حياة أكثر اتزانًا',
    descriptionAr: 'أدوات عملية لتخفيف الضغوط وتحسين جودة الحياة.',
    icon: 'heart',
    tone: 'mist',
    sortOrder: 20,
  },
  {
    slug: 'family',
    nameAr: 'الأسرة والتربية والعلاقات',
    shortAr: 'أسرة أقرب',
    descriptionAr: 'محتوى يعزز التواصل والتربية الإيجابية والعلاقات.',
    icon: 'users',
    tone: 'sand',
    sortOrder: 30,
  },
  {
    slug: 'growth',
    nameAr: 'تطوير الذات والإنتاجية',
    shortAr: 'نسخة أفضل منك',
    descriptionAr: 'خطط وعادات تساعدك على تنظيم حياتك وتحقيق أهدافك.',
    icon: 'target',
    tone: 'olive',
    sortOrder: 40,
  },
  {
    slug: 'money',
    nameAr: 'المال والوعي المالي',
    shortAr: 'وعي مالي أكبر',
    descriptionAr: 'منتجات تساعدك على إدارة أموالك واتخاذ قرارات أوعى.',
    icon: 'wallet',
    tone: 'gold',
    sortOrder: 50,
  },
];

const products = [
  {
    slug: 'kids-stories',
    categorySlug: 'kids',
    titleAr: 'قصص الأطفال والقصص التربوية',
    subtitleAr: 'مجموعة قصص ومحتوى تربوي هادف يساعد على غرس القيم وتنمية شخصية الطفل بطريقة ممتعة.',
    price: 500.00,
    sarPrice: 39.99,
    ratingAverage: 0,
    reviewCount: 0,
  },
  {
    slug: 'mental-balance',
    categorySlug: 'wellness',
    titleAr: 'الصحة النفسية والتوازن',
    subtitleAr: 'محتوى وأدوات عملية تساعد على تقليل الضغوط وتحسين جودة الحياة والتوازن النفسي.',
    price: 500.00,
    sarPrice: 39.99,
    ratingAverage: 0,
    reviewCount: 0,
  },
  {
    slug: 'family-relations',
    categorySlug: 'family',
    titleAr: 'الأسرة والتربية والعلاقات',
    subtitleAr: 'أدلة ومحتوى يساعد على بناء أسرة مستقرة وتعزيز العلاقات والتربية الإيجابية.',
    price: 500.00,
    sarPrice: 39.99,
    ratingAverage: 0,
    reviewCount: 0,
  },
  {
    slug: 'growth-habits',
    categorySlug: 'growth',
    titleAr: 'تطوير الذات والإنتاجية وبناء العادات',
    subtitleAr: 'أدوات تساعد على تنظيم الحياة وإدارة الوقت وبناء العادات الإيجابية وتحقيق الأهداف.',
    price: 500.00,
    sarPrice: 39.99,
    ratingAverage: 0,
    reviewCount: 0,
  },
  {
    slug: 'money-management',
    categorySlug: 'money',
    titleAr: 'النجاح المالي وتحسين إدارة الأموال',
    subtitleAr: 'محتوى رقمي يساعد على إدارة الأموال بوعي أكبر وبناء مصادر دخل إضافية واتخاذ قرارات مالية أفضل.',
    price: 500.00,
    sarPrice: 39.99,
    ratingAverage: 0,
    reviewCount: 0,
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  for (const product of products) {
    const { categorySlug, ...data } = product;

    await prisma.product.upsert({
      where: { slug: data.slug },
      update: {
        ...data,
        currency: 'EGP',
        compareAtPrice: null,
        sarCompareAtPrice: null,
        status: ProductStatus.DRAFT,
        featured: true,
        badgeAr: 'منتج أثر',
        category: { connect: { slug: categorySlug } },
      },
      create: {
        ...data,
        currency: 'EGP',
        compareAtPrice: null,
        sarCompareAtPrice: null,
        status: ProductStatus.DRAFT,
        featured: true,
        badgeAr: 'منتج أثر',
        category: { connect: { slug: categorySlug } },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
