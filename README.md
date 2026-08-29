# ATHR — أثر

ATHR is a production-oriented Arabic digital-products store with a static RTL storefront and admin interface, a NestJS API, PostgreSQL/Prisma, Cloudinary product images, private filesystem delivery, and XPay Hosted Checkout.

The confirmed production domain plan is:

- `athar-online.com` — storefront
- `admin.athar-online.com` — administration
- `api.athar-online.com` — API and XPay webhook

## Local development

1. Copy `.env.example` to the ignored `.env` and replace placeholders.
2. Start local PostgreSQL: `docker compose -f infrastructure/docker-compose.dev.yml up -d`.
3. Run `npm ci`, `npm run prisma:migrate:deploy`, and `npm run prisma:seed` if the starter catalog is wanted.
4. Start the API with `npm run dev:api` and the admin with `npm run dev:admin`.

MOCK payment exists only for local automated regression. Production startup fails unless `PAYMENT_PROVIDER=xpay` and `MOCK_PAYMENT_ENABLED=false`.

## Verification

```bash
npm run test:phone
npm run test:production-config
npm run typecheck
npm run build:web
npm run build:api
python3 tools/qa/full-regression.py
```

The regression runner starts the compiled API, creates isolated QA records, exercises the complete local payment/library/download flow, and cleans up.

## Production on OVH

Use [infrastructure/production/OVH-DEPLOYMENT.md](infrastructure/production/OVH-DEPLOYMENT.md). Production database migrations use only `prisma migrate deploy`; the seed command is explicit and is never part of deployment.

The production webhook endpoint is:

`https://api.athar-online.com/api/commerce/webhooks/xpay`

LIVE operation still requires an activated XPay LIVE account, LIVE API key, and LIVE webhook signing secret. Never use test secrets or a temporary tunnel in production.
