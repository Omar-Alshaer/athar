-- Existing phone values remain untouched for backward compatibility. New and
-- updated values are normalized to E.164 by the API before persistence.
ALTER TABLE "User" ADD COLUMN "phoneCountry" TEXT;

-- Retaining the hosted URL lets a customer safely resume a still-pending XPay
-- session without creating or charging a second order.
ALTER TABLE "Payment" ADD COLUMN "providerCheckoutUrl" TEXT;
