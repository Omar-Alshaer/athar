# ATHR platform migration roadmap

Production domains:

- Storefront: `https://athar-online.com`
- Admin: `https://admin.athar-online.com`
- API: `https://api.athar-online.com`

The current static storefront stays in place during the migration so visual work is not lost.

## Patch sequence

### 027 — Platform foundation (this patch)

- npm workspace foundation
- NestJS API shell
- PostgreSQL + Prisma schema
- current five categories/products available as seed data
- Cloudinary server-side image service
- database models for customers, sessions, wishlist, newsletter, orders, payments, library, downloads and admin audit logs
- XPay environment placeholders with `PAYMENT_PROVIDER=mock`

### 028 — Catalog API + Cloudinary admin media primitives

- public categories/products API
- product image upload/delete primitives protected for admin use
- migrate storefront catalog reads away from `data.js`
- retain a temporary static fallback while migration is verified

### 029 — Customer authentication + account shell

- register/login/logout
- secure HttpOnly session cookie scoped for `.athar-online.com`
- account icon becomes functional
- customer profile and My Library shell

### 030 — Wishlist + newsletter persistence

- guest wishlist remains in browser localStorage
- authenticated wishlist persists in PostgreSQL and guest items merge on sign-in
- newsletter footer writes to PostgreSQL
- duplicate subscription handling + unsubscribe state

### 031 — Admin subdomain application

- separate `apps/admin` application for `admin.athar-online.com`
- category/product CRUD
- Cloudinary cover/gallery management
- customer accounts
- newsletter subscribers
- orders/payments
- library grants and audit log

### 032 — Orders + payment abstraction

- server-created orders
- mock payment provider for safe end-to-end testing
- order state machine
- no WhatsApp dependency for purchase completion

### 033 — XPay sandbox integration

- hosted checkout/session creation
- signed webhook verification
- idempotent payment events
- grant purchased books only after verified successful payment

### 034 — Private digital library

- protected digital file storage
- entitlement checks
- signed/short-lived downloads
- download history

### 035 — Production deployment

- API + storefront + admin containers
- PostgreSQL backups
- Nginx/TLS for the three domains
- health checks, security headers, rate limiting and deployment runbook

## Image policy

Cloudinary is the image system for ATHR: product covers, galleries, previews and future marketing imagery. Cloudinary API secrets stay server-side. The future admin upload endpoint must require an authenticated admin session and must never expose `CLOUDINARY_API_SECRET` to the browser.

Purchased PDF/book files are intentionally kept separate from public image delivery. They will use private file storage with authorization checks in Patch 034.
