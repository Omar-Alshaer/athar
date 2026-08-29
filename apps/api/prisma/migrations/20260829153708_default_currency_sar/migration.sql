-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'SAR';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'SAR';

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "currency" SET DEFAULT 'SAR';
