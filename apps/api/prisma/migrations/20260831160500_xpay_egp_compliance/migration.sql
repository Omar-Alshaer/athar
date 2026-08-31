-- ATHR XPay Egypt compliance + dual-currency pricing.
-- EGP is authoritative for new checkout/payment amounts.
-- SAR is displayed alongside EGP on the storefront.
-- Historical paid SAR orders/payments keep their original currency.

ALTER TABLE "Product"
  ADD COLUMN "compareAtPrice" DECIMAL(10,2),
  ADD COLUMN "sarPrice" DECIMAL(10,2),
  ADD COLUMN "sarCompareAtPrice" DECIMAL(10,2);

-- Production products are currently SAR. Preserve that amount first.
UPDATE "Product"
SET "sarPrice" = "price"
WHERE "sarPrice" IS NULL;

-- The existing local compliance decision set current products to 500 EGP.
-- Admin can change each EGP/SAR price independently after migration.
UPDATE "Product"
SET
  "currency" = 'EGP',
  "price" = 500.00
WHERE "currency" = 'SAR';

ALTER TABLE "Product"
  ALTER COLUMN "sarPrice" SET NOT NULL,
  ALTER COLUMN "currency" SET DEFAULT 'EGP';

ALTER TABLE "Order"
  ALTER COLUMN "currency" SET DEFAULT 'EGP';

ALTER TABLE "Payment"
  ALTER COLUMN "currency" SET DEFAULT 'EGP';

-- Never convert old monetary amounts by changing only their label.
-- Cancel unfinished legacy SAR attempts; the customer can create a fresh EGP order.
UPDATE "Payment"
SET
  "status" = 'CANCELLED',
  "failureCode" = COALESCE("failureCode", 'currency_migration'),
  "failureMessage" = COALESCE("failureMessage", 'Legacy SAR attempt cancelled during EGP checkout migration.')
WHERE "currency" = 'SAR'
  AND "status" IN ('PENDING', 'FAILED');

UPDATE "Order"
SET "status" = 'CANCELLED'
WHERE "currency" = 'SAR'
  AND "status" IN ('PENDING_PAYMENT', 'PAYMENT_FAILED');
