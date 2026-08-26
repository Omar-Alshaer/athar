# ATHR Admin subdomain foundation

The administration UI is a separate application under `apps/admin`.

Production routing target:

- `https://athar-online.com` — customer storefront
- `https://admin.athar-online.com` — admin application
- `https://api.athar-online.com` — NestJS API

The admin UI is intentionally **not** exposed as `/admin/login` on the customer storefront. Opening the root of the admin subdomain shows the login screen when there is no valid admin session.

## Local development

Start the API:

```bash
npm run dev:api
```

Start the separate admin application:

```bash
npm run dev:admin
```

Then open `http://127.0.0.1:3100`.

## Bootstrap the first Super Admin

Use a strong password of at least 12 characters. The command is idempotent and promotes/updates the selected email as `SUPER_ADMIN`.

```bash
ATHR_ADMIN_EMAIL='admin@example.com' \
ATHR_ADMIN_PASSWORD='replace-with-a-strong-password' \
ATHR_ADMIN_NAME='مدير أثر' \
npm run admin:bootstrap
```

Do not commit these credentials to Git.

## Security model

- Admin uses a separate `athr_admin_session` HttpOnly cookie.
- Customer and admin browser sessions do not overwrite each other.
- Admin API routes are protected server-side by role (`ADMIN` or `SUPER_ADMIN`).
- A customer cannot gain admin access by opening the admin subdomain.
- Successful admin login is written to `AdminAuditLog`.
- Patch 032 is read-only for business data. Product/category writes and Cloudinary uploads are added only after this protected admin foundation.
