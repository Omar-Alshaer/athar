-- Read-only production cleanliness audit. Review rows; this script deletes nothing.
SELECT role, status, COUNT(*) AS users FROM "User" GROUP BY role, status ORDER BY role, status;
SELECT status, currency, COUNT(*) AS orders FROM "Order" GROUP BY status, currency ORDER BY status, currency;
SELECT provider, status, currency, COUNT(*) AS payments FROM "Payment" GROUP BY provider, status, currency ORDER BY provider, status, currency;
SELECT status, COUNT(*) AS newsletter FROM "NewsletterSubscription" GROUP BY status ORDER BY status;
SELECT COUNT(*) AS webhook_events, COUNT(*) FILTER (WHERE "processedAt" IS NULL) AS unprocessed FROM "PaymentWebhookEvent";
SELECT id, email, role, "createdAt" FROM "User" WHERE email ~* '(^qa[.+]|example\.com$|test)' ORDER BY "createdAt" DESC;
SELECT id, "orderNumber", status, currency, "createdAt" FROM "Order" WHERE "orderNumber" ~* '(qa|test)' ORDER BY "createdAt" DESC;
SELECT id, slug, status, "createdAt" FROM "Product" WHERE slug ~* '(^qa-|test|demo)' ORDER BY "createdAt" DESC;
SELECT id, slug, "isActive", "createdAt" FROM "Category" WHERE slug ~* '(^qa-|test|demo)' ORDER BY "createdAt" DESC;
