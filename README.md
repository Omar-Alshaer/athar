# ATHR — أثر

ATHR is being migrated from a static RTL digital-products storefront into a full customer/account, catalog, admin, payment and private-library platform.

## Current storefront

The existing HTML/CSS/JavaScript storefront remains at the repository root during the migration. This keeps the current visual design working while backend capabilities are added patch by patch.

## Platform foundation

Patch 027 adds:

- NestJS API under `apps/api`
- PostgreSQL + Prisma domain model
- Cloudinary server-side image integration foundation
- seed data for the current five categories and five products
- models for users, sessions, wishlist, newsletter, orders, payments, customer library and admin audit logs
- development PostgreSQL through Docker Compose

Production domain plan:

- `athar-online.com` — storefront
- `admin.athar-online.com` — admin dashboard
- `api.athar-online.com` — API

## Start the foundation locally

1. Create the local environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma Client and create the initial migration:

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name platform_foundation
```

5. Seed the five existing categories/products:

```bash
npm run prisma:seed
```

6. Start the API:

```bash
npm run dev:api
```

Health endpoints:

- `http://127.0.0.1:4000/api/health/live`
- `http://127.0.0.1:4000/api/health/ready`

See `docs/PLATFORM-ROADMAP.md` for the migration sequence.

## Admin dashboard foundation (Patch 032)

A separate admin application now lives in `apps/admin` and is designed for `admin.athar-online.com`. It uses protected admin-only API routes and a separate HttpOnly session cookie. See `docs/ADMIN-SUBDOMAIN.md` for local startup and Super Admin bootstrap instructions.
